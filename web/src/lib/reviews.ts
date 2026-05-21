import { app } from './app'
import { ensureMigrated } from './db'
import type { MowerReviewRow } from './db'
import type { MowerReview } from '../models'

function rowToReview(r: MowerReviewRow): MowerReview {
  return {
    id: r.id,
    mowerId: r.mower_id,
    reviewerId: r.reviewer_id,
    groupId: r.group_id,
    scheduleId: r.schedule_id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface ReviewCreate {
  mowerId: string
  reviewerId: string
  rating: number
  comment?: string | null
  groupId?: string | null
  scheduleId?: string | null
}

export async function createReview(input: ReviewCreate): Promise<MowerReview> {
  await ensureMigrated()
  if (input.rating < 1 || input.rating > 5) throw new Error('rating must be 1..5')
  const id = crypto.randomUUID()
  const now = Date.now()
  await app.db.execute(
    `INSERT INTO mower_reviews (id, mower_id, reviewer_id, group_id, schedule_id, rating, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.mowerId, input.reviewerId, input.groupId ?? null, input.scheduleId ?? null, input.rating, input.comment ?? null, now, now],
  )
  return {
    id,
    mowerId: input.mowerId,
    reviewerId: input.reviewerId,
    groupId: input.groupId ?? null,
    scheduleId: input.scheduleId ?? null,
    rating: input.rating,
    comment: input.comment ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function listReviews(mowerId: string): Promise<MowerReview[]> {
  await ensureMigrated()
  const { rows } = await app.db.query<MowerReviewRow>(
    'SELECT * FROM mower_reviews WHERE mower_id = ? ORDER BY created_at DESC',
    [mowerId],
  )
  return rows.map(rowToReview)
}

export interface ReviewPatch {
  rating?: number
  comment?: string | null
}

export async function updateReview(id: string, patch: ReviewPatch): Promise<void> {
  await ensureMigrated()
  const sets: string[] = []
  const params: unknown[] = []
  if ('rating' in patch) {
    if (patch.rating! < 1 || patch.rating! > 5) throw new Error('rating must be 1..5')
    sets.push('rating = ?')
    params.push(patch.rating)
  }
  if ('comment' in patch) {
    sets.push('comment = ?')
    params.push(patch.comment ?? null)
  }
  if (sets.length === 0) return
  sets.push('updated_at = ?')
  params.push(Date.now())
  await app.db.execute(`UPDATE mower_reviews SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function deleteReview(id: string): Promise<void> {
  await ensureMigrated()
  await app.db.execute('DELETE FROM mower_reviews WHERE id = ?', [id])
}

export async function averageRating(mowerId: string): Promise<{ average: number; count: number }> {
  await ensureMigrated()
  const { rows } = await app.db.query<{ avg: number | null; n: number }>(
    'SELECT AVG(rating) AS avg, COUNT(*) AS n FROM mower_reviews WHERE mower_id = ?',
    [mowerId],
  )
  return { average: rows[0]?.avg ?? 0, count: rows[0]?.n ?? 0 }
}
