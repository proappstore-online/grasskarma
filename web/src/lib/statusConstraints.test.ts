// Exercise the deploy ledger and action boundary against SQLite. Migration 0003
// intentionally leaves legacy data untouched: additive compatibility views make
// it safe to read, and registered actions refuse invalid new values.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { validateScheduleRange, validateScheduleStatus } from './schedules'
import { validateStreetGroupStatus } from './streetGroups'

type Param = { default?: string | number | null }
type Tool = { name: string; sql?: string; params?: Record<string, Param> }
type Migration = { name: string; sql: string }

const root = new URL('../../../', import.meta.url)
const migrations: { migrations: Migration[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
const forbiddenMigrationKeyword = /\b(DROP|DELETE|UPDATE|RENAME|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX|REPLACE)\b/i

let db: DatabaseSync

function migration(name: string): Migration {
  const found = migrations.migrations.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`Missing migration ${name}`)
  return found
}

function tool(name: string): Tool {
  const found = tools.find((candidate) => candidate.name === name)
  if (!found?.sql) throw new Error(`Missing SQL action ${name}`)
  return found
}

function bind(action: Tool, params: Record<string, string | number | null>, userId: string) {
  const values: Record<string, string | number | null> = { __user_id: userId, __now: 1_700_000_000_000 }
  for (const [name, definition] of Object.entries(action.params ?? {})) values[name] = definition.default ?? null
  Object.assign(values, params)
  const args: (string | number | null)[] = []
  return {
    text: action.sql!.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
      args.push(values[name] ?? null)
      return '?'
    }),
    args,
  }
}

function call(name: string, userId: string, params: Record<string, string | number | null>) {
  const statement = bind(tool(name), params, userId)
  return db.prepare(statement.text).run(...statement.args)
}

function seedAdminGroup() {
  db.prepare("INSERT INTO users (id, role, created_at, updated_at) VALUES ('admin', 'admin', 1, 1)").run()
  db.prepare("INSERT INTO street_groups (id, name, admin_ids, member_ids, status, created_at, updated_at) VALUES ('group', 'Maple Street', '[\"admin\"]', '[\"admin\"]', 'forming', 1, 1)").run()
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const item of migrations.migrations) db.exec(item.sql)
})

describe('group and schedule compatibility migration', () => {
  it('clean-installs the complete additive ledger and creates the safe read views', () => {
    for (const item of migrations.migrations) expect(item.sql).not.toMatch(forbiddenMigrationKeyword)
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'view' ORDER BY name").all())
      .toEqual([{ name: 'schedules_compatible' }, { name: 'street_groups_compatible' }])
  })

  it('upgrades a prior database without rewriting legacy rows, while views normalize their values', () => {
    const legacy = new DatabaseSync(':memory:')
    legacy.exec(migration('0001_init').sql)
    legacy.exec(migration('0002_street_group_location_unique').sql)
    legacy.prepare("INSERT INTO street_groups (id, name, status, created_at, updated_at) VALUES ('legacy-group', 'Legacy', 'unknown', 1, 1)").run()
    legacy.prepare("INSERT INTO schedules (id, group_id, day_of_week, start_time, status, created_at, updated_at) VALUES ('legacy-schedule', 'legacy-group', 9, '25:61', 'unknown', 1, 1)").run()

    legacy.exec(migration('0003_constrain_group_and_schedule_statuses').sql)
    legacy.exec(migration('0004_public_mower_contact').sql)

    expect(legacy.prepare("SELECT status FROM street_groups WHERE id = 'legacy-group'").get()).toEqual({ status: 'unknown' })
    expect(legacy.prepare("SELECT day_of_week, start_time, status FROM schedules WHERE id = 'legacy-schedule'").get())
      .toEqual({ day_of_week: 9, start_time: '25:61', status: 'unknown' })
    expect(legacy.prepare("SELECT status FROM street_groups_compatible WHERE id = 'legacy-group'").get()).toEqual({ status: 'forming' })
    expect(legacy.prepare("SELECT day_of_week, start_time, status FROM schedules_compatible WHERE id = 'legacy-schedule'").get())
      .toEqual({ day_of_week: null, start_time: null, status: 'planned' })
  })

  it('refuses invalid writes at the registered-action boundary without changing records', () => {
    seedAdminGroup()
    db.prepare("INSERT INTO schedules (id, group_id, status, created_at, updated_at) VALUES ('schedule', 'group', 'planned', 1, 1)").run()

    expect(call('update_group', 'admin', { id: 'group', set_status: 1, status: 'invalid' }).changes).toBe(0)
    expect(call('update_schedule', 'admin', { id: 'schedule', set_status: 1, status: 'invalid' }).changes).toBe(0)
    expect(call('update_schedule', 'admin', { id: 'schedule', set_day_of_week: 1, day_of_week: 7 }).changes).toBe(0)
    expect(call('update_schedule', 'admin', { id: 'schedule', set_start_time: 1, start_time: '24:00' }).changes).toBe(0)

    expect(db.prepare("SELECT status FROM street_groups WHERE id = 'group'").get()).toEqual({ status: 'forming' })
    expect(db.prepare("SELECT day_of_week, start_time, status FROM schedules WHERE id = 'schedule'").get())
      .toEqual({ day_of_week: null, start_time: null, status: 'planned' })
  })

  it('allows valid new schedule values through the registered action', () => {
    seedAdminGroup()
    const base = { group_id: 'group', mower_id: null, due_date: null }

    expect(call('create_schedule', 'admin', { id: 'bad-day', ...base, day_of_week: 7, start_time: '12:00' }).changes).toBe(0)
    expect(call('create_schedule', 'admin', { id: 'bad-time', ...base, day_of_week: 0, start_time: '24:00' }).changes).toBe(0)
    expect(call('create_schedule', 'admin', { id: 'valid', ...base, day_of_week: 6, start_time: '23:59' }).changes).toBe(1)
    expect(db.prepare("SELECT day_of_week, start_time, status FROM schedules_compatible WHERE id = 'valid'").get())
      .toEqual({ day_of_week: 6, start_time: '23:59', status: 'planned' })
  })

  it('gives SDK callers clear validation errors before dispatching an action', () => {
    expect(() => validateStreetGroupStatus('invalid' as never)).toThrow('Street-group status must be')
    expect(() => validateScheduleStatus('invalid' as never)).toThrow('Schedule status must be')
    expect(() => validateScheduleRange({ dayOfWeek: 7, startTime: null })).toThrow('Schedule day must be')
    expect(() => validateScheduleRange({ dayOfWeek: 0, startTime: '24:00' })).toThrow('Schedule start time must')
    expect(() => validateScheduleRange({ dayOfWeek: 6, startTime: '23:59' })).not.toThrow()
  })
})
