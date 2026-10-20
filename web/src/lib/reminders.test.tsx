// Mow reminders (#29, step 1): the registered opt-out actions run against the
// real migrations in SQLite, and the reminder window is computed in local time.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ACTION_MANIFEST } from './actions'
import { upcomingMowReminders } from './reminders'
import { MowReminderBanner, describeReminder } from '../components/MowReminderBanner'
import type { Schedule } from '../models'

type Tool = { name: string; operation: string; sql?: string; statements?: string[] }
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
let db: DatabaseSync

function bind(sql: string, values: Record<string, string | number | null>) {
  const args: (string | number | null)[] = []
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    args.push(values[key] ?? null)
    return '?'
  })
  return { text, args }
}

function tool(name: string): Tool {
  const found = tools.find((t) => t.name === name)
  if (!found) throw new Error(`Missing ${name}`)
  return found
}

function call(name: string, userId: string, params: Record<string, string | number | null> = {}) {
  const values = { __user_id: userId, __now: 1_700_000_000_000, ...params }
  let changes = 0
  db.exec('BEGIN')
  for (const sql of tool(name).statements ?? [tool(name).sql!]) {
    const statement = bind(sql, values)
    changes = Number(db.prepare(statement.text).run(...statement.args).changes)
  }
  db.exec('COMMIT')
  return changes
}

function query(name: string, userId: string) {
  const statement = bind(tool(name).sql!, { __user_id: userId })
  return db.prepare(statement.text).all(...statement.args)
}

const optedOut = () => db.prepare('SELECT user_id FROM reminder_opt_out ORDER BY user_id').all().map((row) => row.user_id)

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  for (const id of ['alice', 'bob']) db.prepare("INSERT INTO users (id, role, created_at, updated_at) VALUES (?, 'client', 1, 1)").run(id)
})

describe('reminder opt-out actions', () => {
  it('are registered and mirrored in the client action manifest', () => {
    for (const name of ['get_reminder_opt_out', 'set_reminder_opt_out', 'clear_reminder_opt_out'] as const) {
      expect(ACTION_MANIFEST[name].operation).toBe(tool(name).operation)
    }
  })

  it('opts the caller out, and only the caller', () => {
    expect(call('set_reminder_opt_out', 'alice')).toBe(1)
    expect(optedOut()).toEqual(['alice'])
    expect(query('get_reminder_opt_out', 'alice')).toHaveLength(1)
    expect(query('get_reminder_opt_out', 'bob')).toHaveLength(0)
  })

  it('treats a repeated opt-out as a one-row success, not a duplicate', () => {
    call('set_reminder_opt_out', 'alice')
    expect(call('set_reminder_opt_out', 'alice')).toBe(1)
    expect(optedOut()).toEqual(['alice'])
  })

  it('refuses an opt-out for a caller with no GrassKarma profile', () => {
    expect(call('set_reminder_opt_out', 'stranger')).toBe(0)
    expect(optedOut()).toEqual([])
  })

  it("turns reminders back on for the caller without touching anyone else's setting", () => {
    call('set_reminder_opt_out', 'alice')
    call('set_reminder_opt_out', 'bob')
    expect(call('clear_reminder_opt_out', 'alice')).toBe(1)
    expect(optedOut()).toEqual(['bob'])
    // Already on: zero rows, which the client reports as a refusal and reloads.
    expect(call('clear_reminder_opt_out', 'alice')).toBe(0)
  })

  it('removes the opt-out with the account', () => {
    call('set_reminder_opt_out', 'alice')
    expect(call('admin_delete_user', 'alice', { user_id: 'alice', photo_keys: '[]' })).toBe(1)
    expect(optedOut()).toEqual([])
  })
})

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: 's', groupId: 'g', dayOfWeek: null, startTime: null, mowerId: 'm', status: 'planned',
    dueDate: null, completedAt: null, afterPhotoUrl: null, myRating: null, myComment: null, confirmationCount: 0, createdAt: 0, updatedAt: 0, ...overrides,
  }
}

describe('upcomingMowReminders', () => {
  // Wednesday 14 October 2026, 20:00 local time.
  const now = new Date(2026, 9, 14, 20, 0)

  it('includes planned mows due today or tomorrow, today first', () => {
    const reminders = upcomingMowReminders([
      schedule({ id: 'tomorrow-morning', dueDate: new Date(2026, 9, 15, 7, 30).getTime() }),
      schedule({ id: 'earlier-today', dueDate: new Date(2026, 9, 14, 9, 0).getTime() }),
      schedule({ id: 'in-two-days', dueDate: new Date(2026, 9, 16, 9, 0).getTime() }),
      schedule({ id: 'yesterday', dueDate: new Date(2026, 9, 13, 9, 0).getTime() }),
    ], now)
    expect(reminders.map((r) => [r.schedule.id, r.day])).toEqual([['earlier-today', 'today'], ['tomorrow-morning', 'tomorrow']])
  })

  it('matches recurring mows by weekday, wrapping Saturday to Sunday', () => {
    expect(upcomingMowReminders([schedule({ id: 'wed', dayOfWeek: 3 }), schedule({ id: 'thu', dayOfWeek: 4 }), schedule({ id: 'fri', dayOfWeek: 5 })], now)
      .map((r) => r.schedule.id)).toEqual(['wed', 'thu'])
    const saturday = new Date(2026, 9, 17, 12, 0)
    expect(upcomingMowReminders([schedule({ dayOfWeek: 0 })], saturday)[0]?.day).toBe('tomorrow')
  })

  it('never reminds about a mow that is done or skipped', () => {
    const today = new Date(2026, 9, 14, 9, 0).getTime()
    expect(upcomingMowReminders([schedule({ status: 'done', dueDate: today }), schedule({ status: 'skipped', dueDate: today })], now)).toEqual([])
  })

  it('describes the mow with its time and place', () => {
    const [reminder] = upcomingMowReminders([schedule({ dayOfWeek: 4, startTime: '09:00' })], now)
    expect(describeReminder(reminder!, 'Maple St')).toBe('Mow tomorrow at 09:00 · Maple St')
    expect(describeReminder({ ...reminder!, day: 'today' }, null)).toBe('Mow today at 09:00')
  })
})

describe('MowReminderBanner', () => {
  it('renders nothing until the opt-out preference has loaded', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <MowReminderBanner schedules={[schedule({ dayOfWeek: new Date().getDay() })]} preferencesPath="/app/preferences" />
      </MemoryRouter>,
    )
    expect(markup).toBe('')
  })
})
