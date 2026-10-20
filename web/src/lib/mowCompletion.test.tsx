// Mower marks a mow done (#29, step 2): the registered complete_schedule batch
// runs against the real migrations in SQLite; the client flow is unit-tested
// with storage and actions mocked.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const completeSchedule = vi.fn()
const uploadMowAfterPhoto = vi.fn()
const queuePhotoCleanup = vi.fn()
const drainPendingPhotoCleanup = vi.fn()
vi.mock('./schedules', () => ({ completeSchedule: (...args: unknown[]) => completeSchedule(...args) }))
vi.mock('./photos', () => ({
  uploadMowAfterPhoto: (...args: unknown[]) => uploadMowAfterPhoto(...args),
  queuePhotoCleanup: (...args: unknown[]) => queuePhotoCleanup(...args),
  drainPendingPhotoCleanup: (...args: unknown[]) => drainPendingPhotoCleanup(...args),
}))

const { markMowDone, afterPhotoProblem } = await import('./mowCompletion')
const { MarkMowDone } = await import('../components/MarkMowDone')

type Tool = { name: string; sql?: string; statements?: string[] }
const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools
const NOW = 1_700_000_000_000
let db: DatabaseSync

function bind(sql: string, values: Record<string, string | number | null>) {
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

/** Run an action like the data worker: every statement in one transaction; the last one's changes is the result. */
function call(name: string, userId: string, params: Record<string, string | number | null>, now = NOW) {
  const values = { __user_id: userId, __now: now, ...params }
  let changes = 0
  db.exec('BEGIN')
  for (const sql of statements(name)) {
    const statement = bind(sql, values)
    changes = Number(db.prepare(statement.text).run(...statement.args).changes)
  }
  db.exec('COMMIT')
  return changes
}

function query(name: string, userId: string, params: Record<string, string | number | null>) {
  const statement = bind(statements(name)[0]!, { __user_id: userId, __now: NOW, ...params })
  return db.prepare(statement.text).all(...statement.args) as Record<string, unknown>[]
}

// Each real call gets its own server time and history id; `now` lets a test model a later retry.
const complete = (userId: string, afterPhotoKey: string | null = null, scheduleId = 's1', now = NOW) => call('complete_schedule', userId, {
  schedule_id: scheduleId, group_id: 'g1', history_id: `h-${userId}-${scheduleId}-${now}`, after_photo_key: afterPhotoKey, date: now,
}, now)
const scheduleStatus = (id = 's1') => (db.prepare('SELECT status FROM schedules WHERE id = ?').get(id) as { status: string }).status
const completions = () => db.prepare('SELECT schedule_id, mower_id, after_photo_key, completed_at FROM mow_completions').all()
const historyCount = () => (db.prepare('SELECT COUNT(*) AS n FROM history_records').get() as { n: number }).n

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
  const user = db.prepare('INSERT INTO users (id, role, street_group_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1)')
  user.run('mower', 'mower', null)
  user.run('other-mower', 'mower', null)
  user.run('member', 'client', 'g1')
  db.prepare(`INSERT INTO street_groups (id, name, street_name, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at)
    VALUES ('g1', 'Maple Street', 'Maple Street', '["member"]', '["member"]', 'mower', 'active', 1, 1)`).run()
  const schedule = db.prepare("INSERT INTO schedules (id, group_id, mower_id, status, due_date, created_at, updated_at) VALUES (?, 'g1', ?, ?, 1, 1, 1)")
  schedule.run('s1', 'mower', 'planned')
  schedule.run('s-skipped', 'mower', 'skipped')
  const photo = db.prepare('INSERT INTO photo_objects (user_id, storage_key, created_at) VALUES (?, ?, 1)')
  photo.run('mower', 'u/mower/lawns/after-1.jpg')
  photo.run('mower', 'u/mower/avatars/avatar-1.jpg')
  photo.run('other-mower', 'u/other-mower/lawns/after-9.jpg')
})

describe('complete_schedule (assigned mower marks a mow done)', () => {
  it('moves planned to done, records history and the completion', () => {
    expect(complete('mower')).toBe(1)
    expect(scheduleStatus()).toBe('done')
    expect(historyCount()).toBe(1)
    expect(completions()).toEqual([{ schedule_id: 's1', mower_id: 'mower', after_photo_key: null, completed_at: NOW }])
  })

  it("stores the mower's own recorded lawn photo and exposes it to group members", () => {
    expect(complete('mower', 'u/mower/lawns/after-1.jpg')).toBe(1)
    const rows = query('list_schedules', 'member', { group_id: 'g1' })
    expect(rows.find((row) => row.id === 's1')?.after_photo_key).toBe('u/mower/lawns/after-1.jpg')
    expect(query('list_schedules_for_mower', 'mower', { limit: 10 }).find((row) => row.id === 's1')?.after_photo_key).toBe('u/mower/lawns/after-1.jpg')
  })

  it.each([
    ['another mower', 'other-mower'],
    ['a group member', 'member'],
  ])('refuses %s and leaves the mow untouched', (_who, userId) => {
    expect(complete(userId)).toBe(0)
    expect(scheduleStatus()).toBe('planned')
    expect(historyCount()).toBe(0)
    expect(completions()).toEqual([])
  })

  it.each([
    ['an unrecorded key', 'u/mower/lawns/never-uploaded.jpg'],
    ["another mower's photo", 'u/other-mower/lawns/after-9.jpg'],
    ['a non-lawn photo', 'u/mower/avatars/avatar-1.jpg'],
  ])('refuses the whole completion for %s', (_what, key) => {
    expect(complete('mower', key)).toBe(0)
    expect(scheduleStatus()).toBe('planned')
    expect(historyCount()).toBe(0)
    expect(completions()).toEqual([])
  })

  it('cannot complete twice, or complete a skipped mow', () => {
    complete('mower')
    expect(complete('mower', null, 's1', NOW + 1)).toBe(0)
    expect(historyCount()).toBe(1)
    expect(completions()).toHaveLength(1)
    expect(complete('mower', null, 's-skipped')).toBe(0)
    expect(scheduleStatus('s-skipped')).toBe('skipped')
  })

  it('removes completions with the group and with the mower account', () => {
    complete('mower')
    call('delete_group', 'member', { group_id: 'g1' })
    expect(completions()).toEqual([])

    db.prepare("INSERT INTO mow_completions (schedule_id, mower_id, completed_at) VALUES ('orphan', 'mower', 1)").run()
    expect(call('admin_delete_user', 'mower', { user_id: 'mower', photo_keys: '[]' })).toBe(1)
    expect(completions()).toEqual([])
  })
})

describe('markMowDone', () => {
  const completion = { scheduleId: 's1', groupId: 'g1', streetName: 'Maple Street' }
  const image = new File(['x'], 'lawn.jpg', { type: 'image/jpeg' })

  beforeEach(() => {
    vi.clearAllMocks()
    uploadMowAfterPhoto.mockResolvedValue('u/mower/lawns/after-1.jpg')
    queuePhotoCleanup.mockResolvedValue(undefined)
    drainPendingPhotoCleanup.mockResolvedValue(undefined)
  })

  it('completes without uploading when there is no photo', async () => {
    await markMowDone(completion, null)
    expect(uploadMowAfterPhoto).not.toHaveBeenCalled()
    expect(completeSchedule).toHaveBeenCalledWith({ ...completion, afterPhotoKey: null })
  })

  it('uploads the photo first and completes with its key', async () => {
    await markMowDone(completion, image)
    expect(completeSchedule).toHaveBeenCalledWith({ ...completion, afterPhotoKey: 'u/mower/lawns/after-1.jpg' })
  })

  it('queues the uploaded photo for cleanup when the completion is refused', async () => {
    completeSchedule.mockRejectedValueOnce(new Error('refused'))
    await expect(markMowDone(completion, image)).rejects.toThrow('refused')
    expect(queuePhotoCleanup).toHaveBeenCalledWith(['u/mower/lawns/after-1.jpg'])
  })

  it('rejects a non-image or oversized file before uploading anything', async () => {
    await expect(markMowDone(completion, new File(['x'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('must be an image')
    expect(afterPhotoProblem(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' }))).toMatch('10 MB')
    expect(uploadMowAfterPhoto).not.toHaveBeenCalled()
    expect(completeSchedule).not.toHaveBeenCalled()
  })
})

describe('MarkMowDone', () => {
  it('names the mow it completes, with the visible text first', () => {
    const markup = renderToStaticMarkup(<MarkMowDone mowLabel="21/10/2026 · 09:00" saving={false} onConfirm={() => undefined} />)
    expect(markup).toContain('aria-label="Mark as done: 21/10/2026 · 09:00"')
    expect(markup).toContain('>Mark as done<')
  })
})
