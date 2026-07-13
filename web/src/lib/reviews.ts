import { ensureMigrated } from './db'
import { q, x } from './actions'
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
  // The reviewer is always the verified caller (`:__user_id`); `input.reviewerId`
  // is the caller's own id.
  await x('create_review', {
    id,
    mower_id: input.mowerId,
    group_id: input.groupId ?? null,
    schedule_id: input.scheduleId ?? null,
    rating: input.rating,
    comment: input.comment ?? null,
  })
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
  const rows = await q<MowerReviewRow>('list_reviews', { mower_id: mowerId })
  return rows.map(rowToReview)
}

export interface ReviewPatch {
  rating?: number
  comment?: string | null
}

export async function updateReview(id: string, patch: ReviewPatch): Promise<void> {
  await ensureMigrated()
  const params: Record<string, unknown> = { id }
  if ('rating' in patch) {
    if (patch.rating! < 1 || patch.rating! > 5) throw new Error('rating must be 1..5')
    params.set_rating = 1
    params.rating = patch.rating
  }
  if ('comment' in patch) {
    params.set_comment = 1
    params.comment = patch.comment ?? null
  }
  if (Object.keys(params).length === 1) return
  await x('update_review', params)
}

export async function deleteReview(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_review', { id })
}

export async function averageRating(mowerId: string): Promise<{ average: number; count: number }> {
  await ensureMigrated()
  const rows = await q<{ avg: number | null; n: number }>('average_rating', { mower_id: mowerId })
  return { average: rows[0]?.avg ?? 0, count: rows[0]?.n ?? 0 }
}
