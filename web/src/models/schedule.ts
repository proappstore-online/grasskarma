export type ScheduleStatus = 'planned' | 'done' | 'skipped'

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
