import { app } from './app'
import { ensureMigrated } from './db'
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
  const { rows } = await app.db.query<ScheduleRow>(
    `SELECT * FROM schedules WHERE group_id = ? ORDER BY due_date ASC NULLS LAST, day_of_week ASC NULLS LAST`,
    [groupId],
  )
  return rows.map(rowToSchedule)
}

export async function listSchedulesForMower(mowerId: string, limit = 100): Promise<Schedule[]> {
  await ensureMigrated()
  const { rows } = await app.db.query<ScheduleRow>(
    `SELECT * FROM schedules WHERE mower_id = ? ORDER BY due_date DESC LIMIT ?`,
    [mowerId, limit],
  )
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
  await app.db.execute(
    `INSERT INTO schedules (id, group_id, day_of_week, start_time, mower_id, status, due_date, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'planned', ?, NULL, ?, ?)`,
    [id, input.groupId, input.dayOfWeek ?? null, input.startTime ?? null, input.mowerId ?? null, input.dueDate ?? null, now, now],
  )
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
  const sets: string[] = []
  const params: unknown[] = []
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`)
    params.push(val)
  }
  if ('dayOfWeek' in patch) push('day_of_week', patch.dayOfWeek ?? null)
  if ('startTime' in patch) push('start_time', patch.startTime ?? null)
  if ('mowerId' in patch) push('mower_id', patch.mowerId ?? null)
  if ('status' in patch) push('status', patch.status)
  if ('dueDate' in patch) push('due_date', patch.dueDate ?? null)
  if ('completedAt' in patch) push('completed_at', patch.completedAt ?? null)
  if (sets.length === 0) return
  push('updated_at', Date.now())
  await app.db.execute(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function markCompleted(id: string): Promise<void> {
  const now = Date.now()
  await updateSchedule(id, { status: 'done', completedAt: now })
}

export async function deleteSchedule(id: string): Promise<void> {
  await ensureMigrated()
  await app.db.execute('DELETE FROM schedules WHERE id = ?', [id])
}
