// Exercise the registered actions as a workflow, including transaction failure
// boundaries. The UI calls these actions; these tests ensure its role-specific
// paths result in durable, consistent data.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

type Tool = { name: string; sql?: string; statements?: string[] }
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
let db: DatabaseSync

function call(name: string, userId: string, params: Record<string, string | number | null>) {
  const action = tools.find((tool) => tool.name === name)
  if (!action) throw new Error(`Missing ${name}`)
  const values: Record<string, string | number | null> = { __user_id: userId, __now: 1_700_000_000_000, ...params }
  const bind = (sql: string) => {
    const args: (string | number | null)[] = []
    const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
      args.push(values[key] ?? null)
      return '?'
    })
    return { text, args }
  }
  db.exec('BEGIN')
  try {
    for (const sql of action.statements ?? [action.sql!]) {
      const statement = bind(sql)
      db.prepare(statement.text).run(...statement.args)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function user(id: string, role: 'client' | 'mower' | 'admin' = 'client') {
  db.prepare('INSERT INTO users (id, role, created_at, updated_at) VALUES (?, ?, 1, 1)').run(id, role)
}

function group() {
  db.prepare("INSERT INTO street_groups (id, name, street_name, admin_ids, member_ids, status, created_at, updated_at) VALUES ('g1', 'Maple Street', 'Maple Street', '[\"admin\"]', '[\"admin\"]', 'forming', 1, 1)").run()
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  user('admin')
  user('mower', 'mower')
  user('applicant')
  group()
})

describe('marketplace workflow actions', () => {
  it('approves a neighbour request atomically', () => {
    db.prepare("INSERT INTO street_group_interests (id, group_id, user_id, created_at) VALUES ('request', 'g1', 'applicant', 1)").run()

    call('approve_group_interest', 'admin', { group_id: 'g1', interest_id: 'request', user_id: 'applicant' })

    expect(db.prepare("SELECT street_group_id FROM users WHERE id = 'applicant'").get()).toEqual({ street_group_id: 'g1' })
    expect(db.prepare("SELECT member_ids FROM street_groups WHERE id = 'g1'").get()).toEqual({ member_ids: '["admin","applicant"]' })
    expect(db.prepare("SELECT id FROM street_group_interests WHERE id = 'request'").get()).toBeUndefined()
  })

  it('rolls back approval if writing the applicant pointer fails', () => {
    db.prepare("INSERT INTO street_group_interests (id, group_id, user_id, created_at) VALUES ('request', 'g1', 'applicant', 1)").run()
    db.exec("CREATE TRIGGER reject_pointer BEFORE UPDATE OF street_group_id ON users WHEN NEW.id = 'applicant' BEGIN SELECT RAISE(ABORT, 'pointer rejected'); END")

    expect(() => call('approve_group_interest', 'admin', { group_id: 'g1', interest_id: 'request', user_id: 'applicant' })).toThrow('pointer rejected')
    expect(db.prepare("SELECT member_ids FROM street_groups WHERE id = 'g1'").get()).toEqual({ member_ids: '["admin"]' })
    expect(db.prepare("SELECT id FROM street_group_interests WHERE id = 'request'").get()).toEqual({ id: 'request' })
  })

  it('lets an admin assign an interested mower, create a schedule, and update it', () => {
    db.prepare("INSERT INTO mower_interests (id, group_id, mower_id, created_at, updated_at) VALUES ('interest', 'g1', 'mower', 1, 1)").run()
    call('update_group', 'admin', { id: 'g1', set_assigned_mower_id: 1, assigned_mower_id: 'mower' })
    call('create_schedule', 'admin', { id: 'schedule', group_id: 'g1', day_of_week: 2, start_time: '09:30', mower_id: 'mower', due_date: 1_800_000_000_000 })
    call('update_schedule', 'admin', { id: 'schedule', set_status: 1, status: 'skipped' })

    expect(db.prepare("SELECT assigned_mower_id FROM street_groups WHERE id = 'g1'").get()).toEqual({ assigned_mower_id: 'mower' })
    expect(db.prepare("SELECT mower_id, status FROM schedules WHERE id = 'schedule'").get()).toEqual({ mower_id: 'mower', status: 'skipped' })
  })

  it('completes a mower job and writes history in one transaction', () => {
    db.prepare("INSERT INTO schedules (id, group_id, mower_id, status, created_at, updated_at) VALUES ('schedule', 'g1', 'mower', 'planned', 1, 1)").run()

    call('complete_schedule', 'mower', { schedule_id: 'schedule', group_id: 'g1', history_id: 'history', street_name: 'Maple Street', area_sqm: 50, duration_min: 30, income: 75, date: 1_700_000_100_000 })

    expect(db.prepare("SELECT status, completed_at FROM schedules WHERE id = 'schedule'").get()).toEqual({ status: 'done', completed_at: 1_700_000_000_000 })
    expect(db.prepare("SELECT mower_id, schedule_id, income FROM history_records WHERE id = 'history'").get()).toEqual({ mower_id: 'mower', schedule_id: 'schedule', income: 75 })
  })

  it('does not mark the schedule done if recording history fails', () => {
    db.prepare("INSERT INTO schedules (id, group_id, mower_id, status, created_at, updated_at) VALUES ('schedule', 'g1', 'mower', 'planned', 1, 1)").run()
    db.exec("CREATE TRIGGER reject_history BEFORE INSERT ON history_records BEGIN SELECT RAISE(ABORT, 'history rejected'); END")

    expect(() => call('complete_schedule', 'mower', { schedule_id: 'schedule', group_id: 'g1', history_id: 'history', street_name: 'Maple Street', area_sqm: null, duration_min: null, income: null, date: 1 })).toThrow('history rejected')
    expect(db.prepare("SELECT status, completed_at FROM schedules WHERE id = 'schedule'").get()).toEqual({ status: 'planned', completed_at: null })
    expect(db.prepare('SELECT id FROM history_records').all()).toEqual([])
  })
})
