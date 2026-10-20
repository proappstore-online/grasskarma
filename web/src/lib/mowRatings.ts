import { ensureMigrated } from './db'
import { q, xOne } from './actions'
import type { Schedule } from '../models'

// Group members confirm a completed mow with a 1-5 rating (#29). The server
// checks membership, the mow's 'done' status and the rating range; these
// helpers only give the UI an early, clear error.

export const MAX_RATING_COMMENT = 280

/** The lifecycle of a mow as one viewer sees it. */
export type MowState = 'upcoming' | 'due' | 'awaiting-confirmation' | 'confirmed' | 'skipped'

export const MOW_STATE_LABEL: Record<MowState, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  'awaiting-confirmation': 'Awaiting your confirmation',
  confirmed: 'Confirmed',
  skipped: 'Skipped',
}

/** A resident's view: a done mow is confirmed once *they* have rated it. */
export function mowState(schedule: Schedule, now: Date = new Date()): MowState {
  if (schedule.status === 'skipped') return 'skipped'
  if (schedule.status === 'done') return schedule.myRating != null ? 'confirmed' : 'awaiting-confirmation'
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const dueToday = schedule.dueDate != null ? schedule.dueDate < endOfToday : schedule.dayOfWeek === now.getDay()
  return dueToday ? 'due' : 'upcoming'
}

/** The mower's view of their finished work: confirmed once any member has. */
export function mowerCompletionLabel(schedule: Schedule): string {
  if (schedule.status === 'skipped') return 'Skipped'
  if (schedule.confirmationCount === 0) return 'Awaiting confirmation'
  return `Confirmed by ${schedule.confirmationCount} resident${schedule.confirmationCount === 1 ? '' : 's'}`
}

export function validateRating(rating: number, comment: string | null): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.')
  if (comment != null && comment.length > MAX_RATING_COMMENT) throw new Error(`Keep the comment to ${MAX_RATING_COMMENT} characters.`)
}

/** Confirm a done mow with a rating; repeating it replaces the caller's rating. */
export async function confirmMow(scheduleId: string, rating: number, comment: string | null): Promise<void> {
  const trimmed = comment?.trim() || null
  validateRating(rating, trimmed)
  await ensureMigrated()
  await xOne('confirm_mow', { schedule_id: scheduleId, rating, comment: trimmed })
}

export interface MowRating {
  scheduleId: string
  userId: string
  rating: number
  comment: string | null
  confirmedAt: number
}

/** All confirmations for a mow (group admins, its mower, platform admins), else the caller's own. */
export async function listMowRatings(scheduleId: string): Promise<MowRating[]> {
  await ensureMigrated()
  const rows = await q<{ schedule_id: string; user_id: string; rating: number; comment: string | null; confirmed_at: number }, 'list_mow_ratings'>('list_mow_ratings', { schedule_id: scheduleId })
  return rows.map((r) => ({ scheduleId: r.schedule_id, userId: r.user_id, rating: r.rating, comment: r.comment, confirmedAt: r.confirmed_at }))
}
