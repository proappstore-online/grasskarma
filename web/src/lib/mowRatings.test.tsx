// Group members confirm and rate a completed mow (#29, step 3): the registered
// actions run against the real migrations in SQLite; the state model, client
// validation and rendered component are tested directly.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Schedule } from '../models'

const xOne = vi.fn()
vi.mock('./actions', async (original) => ({ ...(await original<typeof import('./actions')>()), xOne: (...args: unknown[]) => xOne(...args) }))
vi.mock('./db', async (original) => ({ ...(await original<typeof import('./db')>()), ensureMigrated: async () => undefined }))

const { confirmMow, mowState, mowerCompletionLabel, validateRating } = await import('./mowRatings')
const { ConfirmMow } = await import('../components/ConfirmMow')

type Tool = { name: string; sql?: string; statements?: string[] }
type Params = Record<string, string | number | null>
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
let db: DatabaseSync
let now = 1_700_000_000_000

function bind(sql: string, values: Params) {
  const args: (string | number | null)[] = []
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    args.push(values[key] ?? null)
    return '?'
  })
  return { text, args }
}

function statements(name: string) {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new Error(`Missing ${name}`)
  return tool.statements ?? [tool.sql!]
}

function call(name: string, userId: string, params: Params) {
  const values = { __user_id: userId, __now: ++now, ...params }
  let changes = 0
  db.exec('BEGIN')
  for (const sql of statements(name)) {
    const statement = bind(sql, values)
    changes = Number(db.prepare(statement.text).run(...statement.args).changes)
  }
  db.exec('COMMIT')
  return changes
}

function query(name: string, userId: string, params: Params) {
  const statement = bind(statements(name)[0]!, { __user_id: userId, __now: now, ...params })
  return db.prepare(statement.text).all(...statement.args) as Record<string, unknown>[]
}

const confirm = (userId: string, rating: number, scheduleId = 's-done', comment: string | null = null) =>
  call('confirm_mow', userId, { schedule_id: scheduleId, rating, comment })
const ratings = () => db.prepare('SELECT schedule_id, user_id, rating, comment FROM mow_ratings ORDER BY user_id').all()

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  const user = db.prepare('INSERT INTO users (id, role, street_group_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1)')
  user.run('mower', 'mower', null)
  user.run('group-admin', 'client', 'g1')
  user.run('neighbour', 'client', 'g1')
  user.run('outsider', 'client', null)
  db.prepare(`INSERT INTO street_groups (id, name, street_name, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at)
    VALUES ('g1', 'Maple Street', 'Maple Street', '["group-admin"]', '["group-admin","neighbour"]', 'mower', 'active', 1, 1)`).run()
  const schedule = db.prepare("INSERT INTO schedules (id, group_id, mower_id, status, due_date, created_at, updated_at) VALUES (?, 'g1', 'mower', ?, 1, 1, 1)")
  schedule.run('s-done', 'done')
  schedule.run('s-planned', 'planned')
  schedule.run('s-skipped', 'skipped')
})

describe('confirm_mow', () => {
  it('lets a group member confirm a done mow with a rating and comment', () => {
    expect(confirm('neighbour', 4, 's-done', 'Tidy edges')).toBe(1)
    expect(ratings()).toEqual([{ schedule_id: 's-done', user_id: 'neighbour', rating: 4, comment: 'Tidy edges' }])
  })

  it('replaces a member\'s rating instead of adding a second one', () => {
    confirm('neighbour', 2)
    expect(confirm('neighbour', 5)).toBe(1)
    expect(ratings()).toEqual([{ schedule_id: 's-done', user_id: 'neighbour', rating: 5, comment: null }])
  })

  it.each([
    ['a client outside the group', 'outsider'],
    ['the mower', 'mower'],
    ['someone with no profile', 'stranger'],
  ])('refuses %s', (_who, userId) => {
    expect(confirm(userId, 5)).toBe(0)
    expect(ratings()).toEqual([])
  })

  it.each([0, 6, -1, 2.5])('refuses rating %s', (rating) => {
    expect(confirm('neighbour', rating)).toBe(0)
    expect(ratings()).toEqual([])
  })

  it('refuses a comment over 280 characters', () => {
    expect(confirm('neighbour', 3, 's-done', 'x'.repeat(281))).toBe(0)
    expect(confirm('neighbour', 3, 's-done', 'x'.repeat(280))).toBe(1)
  })

  it.each(['s-planned', 's-skipped', 'missing'])('refuses mow %s, which is not done', (scheduleId) => {
    expect(confirm('neighbour', 5, scheduleId)).toBe(0)
    expect(ratings()).toEqual([])
  })
})

describe('list_mow_ratings', () => {
  beforeEach(() => {
    confirm('neighbour', 4)
    confirm('group-admin', 5)
  })
  const who = (userId: string) => query('list_mow_ratings', userId, { schedule_id: 's-done' }).map((row) => row.user_id).sort()

  it('shows every confirmation to the group admins and the mow\'s mower', () => {
    expect(who('group-admin')).toEqual(['group-admin', 'neighbour'])
    expect(who('mower')).toEqual(['group-admin', 'neighbour'])
  })

  it('shows other members only their own, and outsiders nothing', () => {
    expect(who('neighbour')).toEqual(['neighbour'])
    expect(who('outsider')).toEqual([])
  })
})

describe('ratings in schedule reads and the mower profile', () => {
  it('gives each viewer their own rating and everyone the confirmation count', () => {
    confirm('neighbour', 4, 's-done', 'Good job')
    const row = (userId: string) => query('list_schedules', userId, { group_id: 'g1' }).find((r) => r.id === 's-done')
    expect(row('neighbour')).toMatchObject({ my_rating: 4, my_comment: 'Good job', confirmation_count: 1 })
    expect(row('group-admin')).toMatchObject({ my_rating: null, my_comment: null, confirmation_count: 1 })
    expect(query('list_schedules_for_mower', 'mower', { limit: 10 }).find((r) => r.id === 's-done')).toMatchObject({ confirmation_count: 1 })
  })

  it('folds confirmation ratings into the public aggregate and review list', () => {
    db.prepare("INSERT INTO mower_reviews (id, mower_id, reviewer_id, rating, created_at, updated_at) VALUES ('r1', 'mower', 'group-admin', 2, 1, 1)").run()
    confirm('neighbour', 4, 's-done', 'Good job')
    expect(query('average_rating', 'outsider', { mower_id: 'mower' })).toEqual([{ avg: 3, n: 2 }])
    const reviews = query('list_reviews', 'outsider', { mower_id: 'mower' })
    expect(reviews.map((r) => [r.rating, r.comment, r.reviewer_id])).toEqual(expect.arrayContaining([[4, 'Good job', null], [2, null, null]]))
  })

  it('removes ratings with the member\'s account and with the group', () => {
    confirm('neighbour', 4)
    confirm('group-admin', 5)
    expect(call('admin_delete_user', 'neighbour', { user_id: 'neighbour', photo_keys: '[]' })).toBe(1)
    expect(ratings()).toEqual([{ schedule_id: 's-done', user_id: 'group-admin', rating: 5, comment: null }])
    call('delete_group', 'group-admin', { group_id: 'g1' })
    expect(ratings()).toEqual([])
  })
})

function schedule(overrides: Partial<Schedule>): Schedule {
  return {
    id: 's', groupId: 'g', dayOfWeek: null, startTime: null, mowerId: 'm', status: 'planned', dueDate: null, completedAt: null,
    afterPhotoUrl: null, myRating: null, myComment: null, confirmationCount: 0, createdAt: 0, updatedAt: 0, ...overrides,
  }
}

describe('mow states', () => {
  const now = new Date(2026, 9, 14, 20, 0)

  it('moves upcoming → due → awaiting confirmation → confirmed, or skipped', () => {
    expect(mowState(schedule({ dueDate: new Date(2026, 9, 16).getTime() }), now)).toBe('upcoming')
    expect(mowState(schedule({ dueDate: new Date(2026, 9, 14, 9).getTime() }), now)).toBe('due')
    expect(mowState(schedule({ dueDate: new Date(2026, 9, 12).getTime() }), now)).toBe('due')
    expect(mowState(schedule({ dayOfWeek: now.getDay() }), now)).toBe('due')
    expect(mowState(schedule({ status: 'done' }), now)).toBe('awaiting-confirmation')
    expect(mowState(schedule({ status: 'done', myRating: 3 }), now)).toBe('confirmed')
    expect(mowState(schedule({ status: 'skipped' }), now)).toBe('skipped')
  })

  it('labels the mower\'s finished work by how many residents confirmed', () => {
    expect(mowerCompletionLabel(schedule({ status: 'done' }))).toBe('Awaiting confirmation')
    expect(mowerCompletionLabel(schedule({ status: 'done', confirmationCount: 1 }))).toBe('Confirmed by 1 resident')
    expect(mowerCompletionLabel(schedule({ status: 'done', confirmationCount: 3 }))).toBe('Confirmed by 3 residents')
  })
})

describe('confirmMow', () => {
  beforeEach(() => xOne.mockReset())

  it('sends a trimmed comment, or null for a blank one', async () => {
    await confirmMow('s1', 4, '  Great  ')
    await confirmMow('s1', 5, '   ')
    expect(xOne.mock.calls).toEqual([
      ['confirm_mow', { schedule_id: 's1', rating: 4, comment: 'Great' }],
      ['confirm_mow', { schedule_id: 's1', rating: 5, comment: null }],
    ])
  })

  it('rejects an out-of-range rating or long comment before calling the server', async () => {
    expect(() => validateRating(0, null)).toThrow('1 to 5')
    expect(() => validateRating(6, null)).toThrow('1 to 5')
    await expect(confirmMow('s1', 3, 'x'.repeat(281))).rejects.toThrow('280')
    expect(xOne).not.toHaveBeenCalled()
  })
})

describe('ConfirmMow', () => {
  const render = (overrides: Partial<Schedule>) => renderToStaticMarkup(
    <ConfirmMow schedule={schedule({ status: 'done', ...overrides })} mowLabel="12/10/2026" onSaved={async () => undefined} />,
  )

  it('asks for a rating, with the after-photo described, while awaiting confirmation', () => {
    const markup = render({ afterPhotoUrl: 'https://example.test/after.jpg' })
    expect(markup).toContain('Rate the mow: 12/10/2026')
    expect(markup.match(/type="radio"/g)).toHaveLength(5)
    expect(markup).toContain('alt="After photo of the lawn, mow on 12/10/2026"')
    expect(markup).toMatch(/aria-label="Confirm: 12\/10\/2026"[^>]*disabled=""|disabled=""[^>]*aria-label="Confirm: 12\/10\/2026"/)
  })

  it('shows the member\'s rating once confirmed', () => {
    const markup = render({ myRating: 4 })
    expect(markup).toContain('Confirmed <span aria-hidden="true">★</span>4<span class="sr-only"> out of 5</span>')
    expect(markup).not.toContain('type="radio"')
  })
})
