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
  /** Public URL of the mower's optional after-photo, once the mow is done (#29). */
  afterPhotoUrl: string | null
  createdAt: number
  updatedAt: number
}
