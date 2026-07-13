import { ensureMigrated } from './db'
import { q, x } from './actions'
import type { ScheduleRow } from './db'
import type { Schedule, ScheduleStatus } from '../models'

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

export async function listSchedulesForMower(mowerId: string, limit = 100): Promise<Schedule[]> {
  await ensureMigrated()
  const rows = await q<ScheduleRow>('list_schedules_for_mower', { mower_id: mowerId, limit })
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

export async function deleteSchedule(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_schedule', { id })
}
