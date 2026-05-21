import { app } from './app'
import { ensureMigrated } from './db'
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
  mowerId: string
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
  const id = crypto.randomUUID()
  const date = input.date ?? Date.now()
  await app.db.execute(
    `INSERT INTO history_records (id, mower_id, group_id, schedule_id, street_name, area_sqm, duration_min, income, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.mowerId,
      input.groupId ?? null,
      input.scheduleId ?? null,
      input.streetName ?? null,
      input.areaSqm ?? null,
      input.durationMin ?? null,
      input.income ?? null,
      date,
    ],
  )
  return {
    id,
    mowerId: input.mowerId,
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
  const { rows } = await app.db.query<HistoryRecordRow>(
    'SELECT * FROM history_records WHERE mower_id = ? ORDER BY date DESC LIMIT ?',
    [mowerId, limit],
  )
  return rows.map(rowToRecord)
}
