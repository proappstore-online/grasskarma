import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

type Tool = { name: string; sql?: string; statements?: string[] }
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
let db: DatabaseSync

function call(userId: string, targetId: string) {
  const action = tools.find((tool) => tool.name === 'admin_delete_user')
  if (!action) throw new Error('Missing admin_delete_user')
  const values: Record<string, string | number | null> = { __user_id: userId, __now: 1_700_000_000_000, user_id: targetId }
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

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  user('platform-admin', 'admin')
  user('departing-mower', 'mower')
  user('remaining-member')
  user('other-mower', 'mower')
  db.prepare("INSERT INTO street_groups (id, name, street_name, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at) VALUES ('sole-admin-group', 'Sole admin', 'First Street', '[\"departing-mower\"]', '[\"departing-mower\",\"remaining-member\"]', 'departing-mower', 'active', 1, 1)").run()
  db.prepare("INSERT INTO street_groups (id, name, street_name, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at) VALUES ('orphaned-group', 'Orphaned', 'Second Street', '[\"departing-mower\"]', '[\"departing-mower\"]', 'departing-mower', 'active', 1, 1)").run()
  db.prepare("INSERT INTO schedules (id, group_id, mower_id, status, created_at, updated_at) VALUES ('schedule', 'sole-admin-group', 'departing-mower', 'planned', 1, 1)").run()
  db.prepare("INSERT INTO mower_interests (id, group_id, mower_id, created_at, updated_at) VALUES ('departing-interest', 'sole-admin-group', 'departing-mower', 1, 1)").run()
  db.prepare("INSERT INTO mower_interests (id, group_id, mower_id, created_at, updated_at) VALUES ('other-interest', 'sole-admin-group', 'other-mower', 1, 1)").run()
  db.prepare("INSERT INTO mower_interest_votes (interest_id, voter_id, vote, created_at) VALUES ('departing-interest', 'remaining-member', 1, 1), ('other-interest', 'departing-mower', 1, 1)").run()
  db.prepare("INSERT INTO street_group_interests (id, group_id, user_id, created_at) VALUES ('request', 'sole-admin-group', 'departing-mower', 1)").run()
  db.prepare("INSERT INTO mower_reviews (id, mower_id, reviewer_id, rating, created_at, updated_at) VALUES ('reviewed-departing', 'departing-mower', 'remaining-member', 5, 1, 1), ('written-by-departing', 'other-mower', 'departing-mower', 4, 1, 1)").run()
  db.prepare("INSERT INTO history_records (id, mower_id, group_id, schedule_id, date) VALUES ('history', 'departing-mower', 'sole-admin-group', 'schedule', 1)").run()
})

describe('admin_delete_user', () => {
  it('removes every deleted-user reference while retaining workable groups and unassigned schedules', () => {
    call('platform-admin', 'departing-mower')

    expect(db.prepare("SELECT id FROM users WHERE id = 'departing-mower'").get()).toBeUndefined()
    expect(db.prepare("SELECT admin_ids, member_ids, assigned_mower_id, status FROM street_groups WHERE id = 'sole-admin-group'").get())
      .toEqual({ admin_ids: '["remaining-member"]', member_ids: '["remaining-member"]', assigned_mower_id: null, status: 'active' })
    expect(db.prepare("SELECT admin_ids, member_ids, assigned_mower_id, status FROM street_groups WHERE id = 'orphaned-group'").get())
      .toEqual({ admin_ids: '[]', member_ids: '[]', assigned_mower_id: null, status: 'archived' })
    expect(db.prepare("SELECT mower_id FROM schedules WHERE id = 'schedule'").get()).toEqual({ mower_id: null })
    expect(db.prepare('SELECT id FROM mower_interests').all()).toEqual([{ id: 'other-interest' }])
    expect(db.prepare('SELECT interest_id, voter_id FROM mower_interest_votes').all()).toEqual([])
    expect(db.prepare('SELECT id FROM street_group_interests').all()).toEqual([])
    expect(db.prepare('SELECT id FROM mower_reviews').all()).toEqual([])
    expect(db.prepare('SELECT id FROM history_records').all()).toEqual([])
  })

  it('does not alter references when the caller is not a platform admin', () => {
    call('remaining-member', 'departing-mower')

    expect(db.prepare("SELECT id FROM users WHERE id = 'departing-mower'").get()).toEqual({ id: 'departing-mower' })
    expect(db.prepare("SELECT assigned_mower_id FROM street_groups WHERE id = 'sole-admin-group'").get()).toEqual({ assigned_mower_id: 'departing-mower' })
    expect(db.prepare("SELECT mower_id FROM schedules WHERE id = 'schedule'").get()).toEqual({ mower_id: 'departing-mower' })
    expect(db.prepare('SELECT id FROM history_records').all()).toEqual([{ id: 'history' }])
  })

  it('lets a user delete only their own account through the same atomic cleanup path', () => {
    call('departing-mower', 'departing-mower')

    expect(db.prepare("SELECT id FROM users WHERE id = 'departing-mower'").get()).toBeUndefined()
    expect(db.prepare("SELECT admin_ids, member_ids, assigned_mower_id, status FROM street_groups WHERE id = 'sole-admin-group'").get())
      .toEqual({ admin_ids: '["remaining-member"]', member_ids: '["remaining-member"]', assigned_mower_id: null, status: 'active' })
    expect(db.prepare("SELECT admin_ids, member_ids, assigned_mower_id, status FROM street_groups WHERE id = 'orphaned-group'").get())
      .toEqual({ admin_ids: '[]', member_ids: '[]', assigned_mower_id: null, status: 'archived' })
    expect(db.prepare("SELECT mower_id FROM schedules WHERE id = 'schedule'").get()).toEqual({ mower_id: null })
    expect(db.prepare('SELECT id FROM mower_interests').all()).toEqual([{ id: 'other-interest' }])
    expect(db.prepare('SELECT interest_id, voter_id FROM mower_interest_votes').all()).toEqual([])
    expect(db.prepare('SELECT id FROM street_group_interests').all()).toEqual([])
    expect(db.prepare('SELECT id FROM mower_reviews').all()).toEqual([])
    expect(db.prepare('SELECT id FROM history_records').all()).toEqual([])
  })

  it('rolls back all cleanup if a dependent delete fails', () => {
    db.exec("CREATE TRIGGER reject_history_delete BEFORE DELETE ON history_records BEGIN SELECT RAISE(ABORT, 'history retention failed'); END")

    expect(() => call('platform-admin', 'departing-mower')).toThrow('history retention failed')
    expect(db.prepare("SELECT id FROM users WHERE id = 'departing-mower'").get()).toEqual({ id: 'departing-mower' })
    expect(db.prepare("SELECT admin_ids, member_ids, assigned_mower_id FROM street_groups WHERE id = 'sole-admin-group'").get())
      .toEqual({ admin_ids: '["departing-mower"]', member_ids: '["departing-mower","remaining-member"]', assigned_mower_id: 'departing-mower' })
    expect(db.prepare("SELECT mower_id FROM schedules WHERE id = 'schedule'").get()).toEqual({ mower_id: 'departing-mower' })
    expect(db.prepare('SELECT id FROM mower_interests ORDER BY id').all()).toEqual([{ id: 'departing-interest' }, { id: 'other-interest' }])
  })
})
