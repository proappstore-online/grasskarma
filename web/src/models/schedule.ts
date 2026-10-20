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
  /** The viewer's own confirmation rating (1-5), or null if they have not confirmed. */
  myRating: number | null
  /** The viewer's own confirmation comment, if any. */
  myComment: string | null
  /** How many group members have confirmed this mow. */
  confirmationCount: number
  createdAt: number
  updatedAt: number
}
