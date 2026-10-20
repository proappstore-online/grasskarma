import { ensureMigrated } from './db'
import { q, xOne } from './actions'
import type { Schedule } from '../models'

// In-app mow reminders (#29). The platform has no scheduler an app can use to
// send email or push at a set time, so reminders are a dashboard banner for
// planned mows due today or tomorrow. A user who opts out stops seeing them.

export type ReminderDay = 'today' | 'tomorrow'

export interface MowReminder {
  schedule: Schedule
  day: ReminderDay
}

function localDayStart(time: number | Date): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function reminderDay(schedule: Schedule, now: Date): ReminderDay | null {
  if (schedule.status !== 'planned') return null
  if (schedule.dueDate != null) {
    const today = localDayStart(now)
    const due = localDayStart(schedule.dueDate)
    if (due === today) return 'today'
    // Calendar arithmetic, not +24h, so a daylight-saving change cannot skip a day.
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    return due === tomorrow ? 'tomorrow' : null
  }
  if (schedule.dayOfWeek == null) return null
  if (schedule.dayOfWeek === now.getDay()) return 'today'
  return schedule.dayOfWeek === (now.getDay() + 1) % 7 ? 'tomorrow' : null
}

/** Planned mows due today or tomorrow in the viewer's local time, today first. */
export function upcomingMowReminders(schedules: Schedule[], now: Date = new Date()): MowReminder[] {
  return schedules
    .map((schedule) => ({ schedule, day: reminderDay(schedule, now) }))
    .filter((reminder): reminder is MowReminder => reminder.day !== null)
    .sort((a, b) => (a.day === b.day ? 0 : a.day === 'today' ? -1 : 1))
}

/** Whether the caller has turned reminders off. */
export async function getReminderOptOut(): Promise<boolean> {
  await ensureMigrated()
  const rows = await q<{ user_id: string }, 'get_reminder_opt_out'>('get_reminder_opt_out')
  return rows.length > 0
}

/** Turn the caller's reminders off (`true`) or back on (`false`). */
export async function setReminderOptOut(optOut: boolean): Promise<void> {
  await ensureMigrated()
  await xOne(optOut ? 'set_reminder_opt_out' : 'clear_reminder_opt_out')
}
