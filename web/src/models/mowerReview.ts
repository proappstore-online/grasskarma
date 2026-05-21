export interface MowerReview {
  id: string
  mowerId: string
  reviewerId: string
  groupId: string | null
  scheduleId: string | null
  rating: number
  comment: string | null
  createdAt: number
  updatedAt: number
}
