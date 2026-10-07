import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  x: vi.fn(),
}))

vi.mock('./app', () => ({
  app: { db: { migrate: mocks.migrate } },
}))
vi.mock('./actions', () => ({ q: vi.fn(), x: mocks.x }))

import { createSchedule, updateSchedule } from './schedules'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.migrate.mockResolvedValue(undefined)
  mocks.x.mockResolvedValue({ changes: 1 })
})

describe('schedule action refusals', () => {
  it('throws instead of returning a fabricated schedule when creation affects no rows', async () => {
    mocks.x.mockResolvedValue({ changes: 0 })

    await expect(createSchedule({ groupId: 'group', mowerId: 'mower' }))
      .rejects.toThrow('Schedule creation refused by server.')
  })

  it('throws when an update affects no rows', async () => {
    mocks.x.mockResolvedValue({ changes: 0 })

    await expect(updateSchedule('schedule', { status: 'skipped' }))
      .rejects.toThrow('Schedule update refused by server.')
  })

  it('returns and updates schedules only after a one-row action succeeds', async () => {
    const schedule = await createSchedule({ groupId: 'group', mowerId: 'mower', dayOfWeek: 2, startTime: '09:30' })
    await expect(updateSchedule(schedule.id, { status: 'skipped' })).resolves.toBeUndefined()

    expect(schedule).toMatchObject({ groupId: 'group', mowerId: 'mower', dayOfWeek: 2, startTime: '09:30', status: 'planned' })
    expect(mocks.x).toHaveBeenCalledWith('create_schedule', expect.objectContaining({ group_id: 'group', mower_id: 'mower' }))
    expect(mocks.x).toHaveBeenCalledWith('update_schedule', expect.objectContaining({ id: schedule.id, set_status: 1, status: 'skipped' }))
  })
})
