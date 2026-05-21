export interface HistoryRecord {
  id: string
  mowerId: string
  groupId: string | null
  scheduleId: string | null
  streetName: string | null
  areaSqm: number | null
  durationMin: number | null
  income: number | null
  date: number
}
