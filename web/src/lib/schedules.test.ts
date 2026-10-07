import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  xOne: vi.fn(),
}))

vi.mock('./app', () => ({
  app: { db: { migrate: mocks.migrate } },
}))
vi.mock('./actions', () => ({ q: vi.fn(), xOne: mocks.xOne, xBatch: vi.fn() }))

import { createSchedule, updateSchedule } from './schedules'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.migrate.mockResolvedValue(undefined)
  mocks.xOne.mockResolvedValue({ changes: 1 })
})

describe('schedule action refusals', () => {
  it('throws instead of returning a fabricated schedule when creation affects no rows', async () => {
    mocks.xOne.mockRejectedValue(new Error('create_schedule was refused by the server.'))

    await expect(createSchedule({ groupId: 'group', mowerId: 'mower' }))
      .rejects.toThrow('refused by the server')
  })

  it('throws when an update affects no rows', async () => {
    mocks.xOne.mockRejectedValue(new Error('update_schedule was refused by the server.'))

    await expect(updateSchedule('schedule', { status: 'skipped' }))
      .rejects.toThrow('refused by the server')
  })

  it('returns and updates schedules only after a one-row action succeeds', async () => {
    const schedule = await createSchedule({ groupId: 'group', mowerId: 'mower', dayOfWeek: 2, startTime: '09:30' })
    await expect(updateSchedule(schedule.id, { status: 'skipped' })).resolves.toBeUndefined()

    expect(schedule).toMatchObject({ groupId: 'group', mowerId: 'mower', dayOfWeek: 2, startTime: '09:30', status: 'planned' })
    expect(mocks.xOne).toHaveBeenCalledWith('create_schedule', expect.objectContaining({ group_id: 'group', mower_id: 'mower' }))
    expect(mocks.xOne).toHaveBeenCalledWith('update_schedule', expect.objectContaining({ id: schedule.id, set_status: 1, status: 'skipped' }))
  })
})
