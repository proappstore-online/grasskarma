/** The canonical lifecycle values for a mowing schedule. */
export const SCHEDULE_STATUSES = ['planned', 'done', 'skipped'] as const
export type ScheduleStatus = typeof SCHEDULE_STATUSES[number]

export interface Schedule {
  id: string
  groupId: string
  dayOfWeek: number | null
  startTime: string | null
  mowerId: string | null
  status: ScheduleStatus
  dueDate: number | null
  completedAt: number | null
  createdAt: number
  updatedAt: number
}
