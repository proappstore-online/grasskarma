export interface MowerInterest {
  id: string
  groupId: string
  mowerId: string
  message: string | null
  createdAt: number
  updatedAt: number
}

export interface MowerInterestVote {
  interestId: string
  voterId: string
  vote: -1 | 1
  createdAt: number
}
