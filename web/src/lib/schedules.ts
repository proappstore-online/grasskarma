import { ensureMigrated } from './db'
import { q, x } from './actions'
import type { ScheduleRow } from './db'
import type { Schedule, ScheduleStatus } from '../models'

const SCHEDULE_STATUSES = new Set<ScheduleStatus>(['planned', 'done', 'skipped'])
const SCHEDULE_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/**
 * Schedule day 0 is Sunday and day 6 is Saturday; times are 24-hour HH:MM.
 * D1 enforces the same invariant, while this provides callers a clear error
 * before an action is sent.
 */
export function validateScheduleRange(input: Pick<ScheduleCreate, 'dayOfWeek' | 'startTime'>): void {
  if (input.dayOfWeek != null && (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6)) {
    throw new Error('Schedule day must be an integer from 0 (Sunday) to 6 (Saturday).')
  }
  if (input.startTime != null && !SCHEDULE_TIME.test(input.startTime)) {
    throw new Error('Schedule start time must use 24-hour HH:MM format.')
  }
}

export function validateScheduleStatus(status: ScheduleStatus): void {
  if (!SCHEDULE_STATUSES.has(status)) throw new Error('Schedule status must be planned, done, or skipped.')
}

function rowToSchedule(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    groupId: r.group_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    mowerId: r.mower_id,
    status: r.status,
    dueDate: r.due_date,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listSchedules(groupId: string): Promise<Schedule[]> {
  await ensureMigrated()
  const rows = await q<ScheduleRow>('list_schedules', { group_id: groupId })
  return rows.map(rowToSchedule)
}

// Always the verified caller's (`:__user_id`) own schedules.
export async function listSchedulesForMower(limit = 100): Promise<Schedule[]> {
  await ensureMigrated()
  const rows = await q<ScheduleRow>('list_schedules_for_mower', { limit })
  return rows.map(rowToSchedule)
}

export interface ScheduleCreate {
  groupId: string
  dayOfWeek?: number | null
  startTime?: string | null
  mowerId?: string | null
  dueDate?: number | null
}

export async function createSchedule(input: ScheduleCreate): Promise<Schedule> {
  await ensureMigrated()
  validateScheduleRange(input)
  const id = crypto.randomUUID()
  const now = Date.now()
  await x('create_schedule', {
    id,
    group_id: input.groupId,
    day_of_week: input.dayOfWeek ?? null,
    start_time: input.startTime ?? null,
    mower_id: input.mowerId ?? null,
    due_date: input.dueDate ?? null,
  })
  return {
    id,
    groupId: input.groupId,
    dayOfWeek: input.dayOfWeek ?? null,
    startTime: input.startTime ?? null,
    mowerId: input.mowerId ?? null,
    status: 'planned',
    dueDate: input.dueDate ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export interface SchedulePatch {
  dayOfWeek?: number | null
  startTime?: string | null
  mowerId?: string | null
  status?: ScheduleStatus
  dueDate?: number | null
  completedAt?: number | null
}

export async function updateSchedule(id: string, patch: SchedulePatch): Promise<void> {
  await ensureMigrated()
  validateScheduleRange({
    dayOfWeek: patch.dayOfWeek,
    startTime: patch.startTime,
  })
  if ('status' in patch && patch.status != null) validateScheduleStatus(patch.status)
  const params: Record<string, unknown> = { id }
  const set = (flag: string, col: string, val: unknown) => {
    params[flag] = 1
    params[col] = val
  }
  if ('dayOfWeek' in patch) set('set_day_of_week', 'day_of_week', patch.dayOfWeek ?? null)
  if ('startTime' in patch) set('set_start_time', 'start_time', patch.startTime ?? null)
  if ('mowerId' in patch) set('set_mower_id', 'mower_id', patch.mowerId ?? null)
  if ('status' in patch) set('set_status', 'status', patch.status)
  if ('dueDate' in patch) set('set_due_date', 'due_date', patch.dueDate ?? null)
  if ('completedAt' in patch) set('set_completed_at', 'completed_at', patch.completedAt ?? null)
  if (Object.keys(params).length === 1) return
  await x('update_schedule', params)
}

export async function markCompleted(id: string): Promise<void> {
  const now = Date.now()
  await updateSchedule(id, { status: 'done', completedAt: now })
}

export interface ScheduleCompletion {
  scheduleId: string
  groupId: string
  streetName?: string | null
  areaSqm?: number | null
  durationMin?: number | null
  income?: number | null
}

/** Complete an assigned job and add its mower history entry atomically. */
export async function completeSchedule(input: ScheduleCompletion): Promise<void> {
  await ensureMigrated()
  await x('complete_schedule', {
    schedule_id: input.scheduleId,
    group_id: input.groupId,
    history_id: crypto.randomUUID(),
    street_name: input.streetName ?? null,
    area_sqm: input.areaSqm ?? null,
    duration_min: input.durationMin ?? null,
    income: input.income ?? null,
    date: Date.now(),
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_schedule', { id })
}
