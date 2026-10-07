import { ensureMigrated } from './db'
import { requireAuthenticatedCaller } from './caller'
import { q, xOne } from './actions'
import type { HistoryRecordRow } from './db'
import type { HistoryRecord } from '../models'

function rowToRecord(r: HistoryRecordRow): HistoryRecord {
  return {
    id: r.id,
    mowerId: r.mower_id,
    groupId: r.group_id,
    scheduleId: r.schedule_id,
    streetName: r.street_name,
    areaSqm: r.area_sqm,
    durationMin: r.duration_min,
    income: r.income,
    date: r.date,
  }
}

export interface HistoryCreate {
  streetName?: string | null
  groupId?: string | null
  scheduleId?: string | null
  areaSqm?: number | null
  durationMin?: number | null
  income?: number | null
  date?: number
}

export async function recordHistory(input: HistoryCreate): Promise<HistoryRecord> {
  await ensureMigrated()
  const mowerId = requireAuthenticatedCaller()
  const id = crypto.randomUUID()
  const date = input.date ?? Date.now()
  // The mower is always the verified caller (`:__user_id`).
  await xOne('record_history', {
    id,
    group_id: input.groupId ?? null,
    schedule_id: input.scheduleId ?? null,
    street_name: input.streetName ?? null,
    area_sqm: input.areaSqm ?? null,
    duration_min: input.durationMin ?? null,
    income: input.income ?? null,
    date,
  })
  return {
    id,
    mowerId,
    groupId: input.groupId ?? null,
    scheduleId: input.scheduleId ?? null,
    streetName: input.streetName ?? null,
    areaSqm: input.areaSqm ?? null,
    durationMin: input.durationMin ?? null,
    income: input.income ?? null,
    date,
  }
}

export async function listHistory(mowerId: string, limit = 200): Promise<HistoryRecord[]> {
  await ensureMigrated()
  const rows = await q<HistoryRecordRow, 'list_history'>('list_history', { mower_id: mowerId, limit })
  return rows.map(rowToRecord)
}
