import { describe, expect, it } from 'vitest'
import { completionForSchedule, upcomingSchedules } from './MowerDashboardPage'
import type { Schedule, StreetGroup } from '../../models'

const schedule = (id: string, dueDate: number | null, status: Schedule['status'] = 'planned'): Schedule => ({
  id,
  groupId: 'group-1',
  dayOfWeek: null,
  startTime: null,
  mowerId: 'mower-1',
  status,
  dueDate,
  completedAt: null,
  createdAt: 1,
  updatedAt: 1,
})

const group: StreetGroup = {
  id: 'group-1',
  name: 'Maple Street neighbours',
  streetName: 'Maple Street',
  suburb: 'Carlton',
  postcode: '3053',
  state: null,
  country: 'AU',
  centerLat: null,
  centerLng: null,
  adminIds: ['client-1'],
  memberIds: ['client-1'],
  assignedMowerId: 'mower-1',
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
}

describe('MowerDashboardPage upcoming jobs', () => {
  it('lists planned jobs soonest first, with undated jobs last, from the newest-first query', () => {
    const fromQuery = [schedule('later', 300), schedule('done', 250, 'done'), schedule('soon', 100), schedule('undated', null)]

    expect(upcomingSchedules(fromQuery).map((item) => item.id)).toEqual(['soon', 'later', 'undated'])
  })

  it('completes a job whose group is no longer in the assigned list instead of silently doing nothing', () => {
    expect(completionForSchedule(schedule('job', 100), [])).toEqual({
      scheduleId: 'job',
      groupId: 'group-1',
      streetName: null,
    })
    expect(completionForSchedule(schedule('job', 100), [group]).streetName).toBe('Maple Street')
  })
})
