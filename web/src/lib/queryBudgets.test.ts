// Query budgets for the hot server actions (#31), on a database seeded at
// city scale. Mirrors tennis-clubs' test_performance_budgets.py:
//   - rows scanned: the query plan may not fully SCAN any table that grows with
//     the user base (node:sqlite cannot count rows read; the plan is the
//     deterministic stand-in, and D1 bills by rows read)
//   - time: median of 7 runs after one warm-up, against perf-budgets.json
//   - result size: rows returned stay bounded by the caller's data
// It also covers the behaviour of the reads #31 added or rewrote.
// PERF_REPORT=1 prints the measurements used to set the budgets.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'

type Tool = { name: string; sql?: string; statements?: string[] }
type Params = Record<string, string | number | null>
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools = new Map<string, Tool>(JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools.map((t: Tool) => [t.name, t]))
const budgets: { query_ms: Record<string, number>; query_max_rows: Record<string, number> } = JSON.parse(readFileSync(new URL('perf-budgets.json', root), 'utf8'))

// City scale: 1,200 street groups of 5 homeowners, 300 mowers, a year of mows.
export const SCALE = { groups: 1200, membersPerGroup: 5, mowers: 300, schedulesPerGroup: 20 } as const
const RUNS = 7
const NOW = 1_760_000_000_000

/** Tables that grow with the user base; a hot query must reach them through an index. */
const GROWING_TABLES = ['users', 'street_groups', 'schedules', 'mow_completions', 'mow_ratings', 'mower_reviews', 'history_records', 'mower_interests', 'mower_interest_votes', 'street_group_interests', 'reminder_opt_out', 'photo_objects']

let db: DatabaseSync

function bind(sql: string, values: Params) {
  const args: (string | number | null)[] = []
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    args.push(values[key] ?? null)
    return '?'
  })
  return { text, args }
}

function sqlOf(name: string): string {
  const tool = tools.get(name)
  if (!tool?.sql) throw new Error(`${name} is not a single-statement query`)
  return tool.sql
}

function run(name: string, userId: string, params: Params) {
  const { text, args } = bind(sqlOf(name), { __user_id: userId, __now: NOW, ...params })
  return db.prepare(text).all(...args) as Record<string, unknown>[]
}

/** Full-table scans of growing tables in the query's plan. */
function fullScans(name: string, userId: string, params: Params): string[] {
  const { text, args } = bind(sqlOf(name), { __user_id: userId, __now: NOW, ...params })
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${text}`).all(...args) as { detail: string }[]
  return plan.map((row) => row.detail).filter((detail) => {
    const scanned = detail.match(/^SCAN (\w+)/)?.[1]
    if (!scanned || detail.includes('VIRTUAL TABLE')) return false
    // A plan names a table by its alias, so resolve aliases from the SQL.
    const table = GROWING_TABLES.find((t) => t === scanned || new RegExp(`\\b${t}\\s+(?:AS\\s+)?${scanned}\\b`, 'i').test(sqlOf(name)))
    return table !== undefined
  })
}

function medianMs(name: string, userId: string, params: Params): number {
  const { text, args } = bind(sqlOf(name), { __user_id: userId, __now: NOW, ...params })
  const statement = db.prepare(text)
  statement.all(...args) // warm-up
  const timings: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const started = performance.now()
    statement.all(...args)
    timings.push(performance.now() - started)
  }
  timings.sort((a, b) => a - b)
  return timings[Math.floor(RUNS / 2)]!
}

// Fixed ids inside the seeded city: group 7, its first member, its mower.
const GROUP = 'g7'
const MEMBER = 'c7-0'
const MOWER = `m${7 % SCALE.mowers}`

function seed() {
  db.exec('BEGIN')
  const user = db.prepare('INSERT INTO users (id, name, role, suburb, postcode, street_group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1)')
  const group = db.prepare("INSERT INTO street_groups (id, name, street_name, suburb, postcode, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)")
  const schedule = db.prepare('INSERT INTO schedules (id, group_id, mower_id, status, due_date, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1)')
  const completion = db.prepare('INSERT INTO mow_completions (schedule_id, mower_id, after_photo_key, completed_at) VALUES (?, ?, NULL, ?)')
  const rating = db.prepare('INSERT INTO mow_ratings (schedule_id, user_id, rating, comment, confirmed_at) VALUES (?, ?, ?, NULL, ?)')
  const review = db.prepare('INSERT INTO mower_reviews (id, mower_id, reviewer_id, group_id, rating, created_at, updated_at) VALUES (?, ?, ?, ?, 4, 1, 1)')
  const interest = db.prepare('INSERT INTO mower_interests (id, group_id, mower_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1)')
  for (let m = 0; m < SCALE.mowers; m++) user.run(`m${m}`, `Mower ${m}`, 'mower', `Suburb ${m % 60}`, String(3000 + (m % 60)), null)
  user.run('admin', 'Admin', 'admin', null, null, null)
  for (let g = 0; g < SCALE.groups; g++) {
    const members = Array.from({ length: SCALE.membersPerGroup }, (_, i) => `c${g}-${i}`)
    members.forEach((id) => user.run(id, `Homeowner ${id}`, 'client', `Suburb ${g % 60}`, String(3000 + (g % 60)), `g${g}`))
    const mower = `m${g % SCALE.mowers}`
    group.run(`g${g}`, `Street ${g}`, `Street ${g}`, `Suburb ${g % 60}`, String(3000 + (g % 60)), JSON.stringify([members[0]]), JSON.stringify(members), mower, g)
    for (let s = 0; s < SCALE.schedulesPerGroup; s++) {
      const id = `s${g}-${s}`
      const done = s < SCALE.schedulesPerGroup / 2
      schedule.run(id, `g${g}`, mower, done ? 'done' : 'planned', NOW + (s - 10) * 7 * 86_400_000, done ? NOW : null)
      if (done) {
        completion.run(id, mower, NOW)
        members.slice(0, 3).forEach((memberId) => rating.run(id, memberId, 1 + ((g + s) % 5), NOW))
      }
    }
    review.run(`r${g}`, mower, members[0], `g${g}`)
    interest.run(`i${g}`, `g${g}`, `m${(g + 1) % SCALE.mowers}`)
  }
  db.prepare('INSERT INTO reminder_opt_out (user_id, created_at) VALUES (?, 1)').run(MEMBER)
  db.exec('COMMIT')
}

/** Each budget name maps to the action, caller and parameters it measures. */
const QUERIES: Record<string, [string, string, Params]> = {
  'get_user.fellow_member': ['get_user', MEMBER, { id: 'c7-1' }],
  'get_user.mower_profile': ['get_user', MEMBER, { id: MOWER }],
  list_group_members: ['list_group_members', MEMBER, { group_id: GROUP }],
  get_group: ['get_group', MEMBER, { id: GROUP }],
  list_groups_for_mower: ['list_groups_for_mower', MOWER, { limit: 200 }],
  list_groups_by_location: ['list_groups_by_location', MEMBER, { suburb: 'suburb 7', postcode: '3007', limit: 200 }],
  list_schedules: ['list_schedules', MEMBER, { group_id: GROUP }],
  list_schedules_for_mower: ['list_schedules_for_mower', MOWER, { limit: 100 }],
  average_rating: ['average_rating', MEMBER, { mower_id: MOWER }],
  list_reviews: ['list_reviews', MEMBER, { mower_id: MOWER }],
  list_interests_for_group: ['list_interests_for_group', MEMBER, { group_id: GROUP }],
  get_reminder_opt_out: ['get_reminder_opt_out', MEMBER, {}],
}

beforeAll(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  seed()
  if (process.env.PERF_REPORT) {
    for (const [budget, [name, userId, params]] of Object.entries(QUERIES)) {
      console.log(`${budget.padEnd(26)} ${medianMs(name, userId, params).toFixed(3).padStart(8)} ms  ${String(run(name, userId, params).length).padStart(5)} rows  scans: ${fullScans(name, userId, params).join('; ') || 'none'}`)
    }
  }
})

describe('query budgets at city scale', () => {
  it('budgets exactly the measured queries', () => {
    expect(Object.keys(budgets.query_ms).sort()).toEqual(Object.keys(QUERIES).sort())
    expect(Object.keys(budgets.query_max_rows).sort()).toEqual(Object.keys(QUERIES).sort())
  })

  it.each(Object.entries(QUERIES))('%s reads growing tables only through an index', (_budget, [name, userId, params]) => {
    expect(fullScans(name, userId, params)).toEqual([])
  })

  it.each(Object.entries(QUERIES))('%s stays within its time budget', (budget, [name, userId, params]) => {
    expect(medianMs(name, userId, params)).toBeLessThanOrEqual(budgets.query_ms[budget]!)
  })

  it.each(Object.entries(QUERIES))('%s returns a bounded result', (budget, [name, userId, params]) => {
    const rows = run(name, userId, params)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(budgets.query_max_rows[budget]!)
  })

  it('catches a full scan when one is introduced', () => {
    // The scan detector itself must work, or every budget above is vacuous.
    tools.set('scan_probe', { name: 'scan_probe', sql: 'SELECT * FROM street_groups g WHERE g.name = :name' })
    expect(fullScans('scan_probe', MEMBER, { name: 'Street 7' })).toEqual(['SCAN g'])
    tools.delete('scan_probe')
  })
})

describe('reads added or rewritten by #31', () => {
  it('list_group_members returns the whole group for members, its mower and admins only', () => {
    const ids = (userId: string) => run('list_group_members', userId, { group_id: GROUP }).map((row) => row.id)
    expect(ids(MEMBER)).toEqual(['c7-0', 'c7-1', 'c7-2', 'c7-3', 'c7-4'])
    expect(ids(MOWER)).toHaveLength(SCALE.membersPerGroup)
    expect(ids('admin')).toHaveLength(SCALE.membersPerGroup)
    expect(ids('c8-0')).toEqual([])
    expect(ids(`m${(7 + 1) % SCALE.mowers}`)).toEqual([])
  })

  it("list_group_members masks other members' private fields like get_user", () => {
    db.prepare("UPDATE users SET email = 'private@example.test' WHERE id = 'c7-1'").run()
    const row = (userId: string) => run('list_group_members', userId, { group_id: GROUP }).find((r) => r.id === 'c7-1')
    expect(row(MEMBER)?.email).toBeNull()
    expect(row('c7-1')?.email).toBe('private@example.test')
    expect(row('admin')?.email).toBe('private@example.test')
  })

  it('get_user still lets fellow members see each other, and nobody else', () => {
    expect(run('get_user', MEMBER, { id: 'c7-1' })).toHaveLength(1)
    expect(run('get_user', 'c8-0', { id: 'c7-1' })).toHaveLength(0)
    // A member whose street_group_id drifted is still found through the caller's group.
    db.prepare("UPDATE users SET street_group_id = NULL WHERE id = 'c7-2'").run()
    expect(run('get_user', MEMBER, { id: 'c7-2' })).toHaveLength(1)
  })

  it('list_groups_for_mower is scoped to the caller', () => {
    const groups = run('list_groups_for_mower', MOWER, { limit: 200 })
    expect(groups.length).toBe(SCALE.groups / SCALE.mowers)
    expect(groups.every((g) => g.assigned_mower_id === MOWER)).toBe(true)
  })

  it('list_groups_by_location matches suburb and postcode case-insensitively, ignoring spaces', () => {
    const groups = run('list_groups_by_location', MEMBER, { suburb: '  SUBURB 7 ', postcode: ' 3007', limit: 200 })
    expect(groups.length).toBe(SCALE.groups / 60)
    expect(groups.every((g) => g.suburb === 'Suburb 7')).toBe(true)
  })
})
