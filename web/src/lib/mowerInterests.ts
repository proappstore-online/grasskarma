import { ensureMigrated } from './db'
import { q, x } from './actions'
import type { MowerInterestRow, MowerInterestVoteRow } from './db'
import type { MowerInterest, MowerInterestVote } from '../models'

function rowToInterest(r: MowerInterestRow): MowerInterest {
  return {
    id: r.id,
    groupId: r.group_id,
    mowerId: r.mower_id,
    message: r.message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToVote(r: MowerInterestVoteRow): MowerInterestVote {
  return {
    interestId: r.interest_id,
    voterId: r.voter_id,
    vote: r.vote,
    createdAt: r.created_at,
  }
}

export async function listInterestsForGroup(groupId: string): Promise<MowerInterest[]> {
  await ensureMigrated()
  const rows = await q<MowerInterestRow>('list_interests_for_group', { group_id: groupId })
  return rows.map(rowToInterest)
}

export async function listInterestsForMower(mowerId: string): Promise<MowerInterest[]> {
  await ensureMigrated()
  const rows = await q<MowerInterestRow>('list_interests_for_mower', { mower_id: mowerId })
  return rows.map(rowToInterest)
}

export async function createMowerInterest(groupId: string, mowerId: string, message: string | null = null): Promise<MowerInterest> {
  await ensureMigrated()
  const id = crypto.randomUUID()
  const now = Date.now()
  // The mower is always the verified caller (`:__user_id`); `mowerId` is the
  // caller's own id at every call site.
  await x('create_mower_interest', { id, group_id: groupId, message })
  return { id, groupId, mowerId, message, createdAt: now, updatedAt: now }
}

export async function deleteMowerInterest(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_mower_interest', { id })
}

export async function castVote(interestId: string, voterId: string, vote: -1 | 1): Promise<void> {
  await ensureMigrated()
  // The voter is always the verified caller (`:__user_id`); `voterId` is the
  // caller's own id at every call site.
  void voterId
  await x('cast_vote', { interest_id: interestId, vote })
}

export async function listVotes(interestId: string): Promise<MowerInterestVote[]> {
  await ensureMigrated()
  const rows = await q<MowerInterestVoteRow>('list_votes', { interest_id: interestId })
  return rows.map(rowToVote)
}

export async function voteTally(interestId: string): Promise<{ up: number; down: number; score: number }> {
  await ensureMigrated()
  const rows = await q<{ up: number; down: number }>('vote_tally', { interest_id: interestId })
  const up = rows[0]?.up ?? 0
  const down = rows[0]?.down ?? 0
  return { up, down, score: up - down }
}
