import { app } from './app'
import { ensureMigrated } from './db'
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
  const { rows } = await app.db.query<MowerInterestRow>(
    'SELECT * FROM mower_interests WHERE group_id = ? ORDER BY created_at DESC',
    [groupId],
  )
  return rows.map(rowToInterest)
}

export async function listInterestsForMower(mowerId: string): Promise<MowerInterest[]> {
  await ensureMigrated()
  const { rows } = await app.db.query<MowerInterestRow>(
    'SELECT * FROM mower_interests WHERE mower_id = ? ORDER BY created_at DESC',
    [mowerId],
  )
  return rows.map(rowToInterest)
}

export async function createMowerInterest(groupId: string, mowerId: string, message: string | null = null): Promise<MowerInterest> {
  await ensureMigrated()
  const id = crypto.randomUUID()
  const now = Date.now()
  await app.db.execute(
    `INSERT OR REPLACE INTO mower_interests (id, group_id, mower_id, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, groupId, mowerId, message, now, now],
  )
  return { id, groupId, mowerId, message, createdAt: now, updatedAt: now }
}

export async function deleteMowerInterest(id: string): Promise<void> {
  await ensureMigrated()
  await app.db.batch([
    { sql: 'DELETE FROM mower_interest_votes WHERE interest_id = ?', params: [id] },
    { sql: 'DELETE FROM mower_interests WHERE id = ?', params: [id] },
  ])
}

export async function castVote(interestId: string, voterId: string, vote: -1 | 1): Promise<void> {
  await ensureMigrated()
  await app.db.execute(
    `INSERT INTO mower_interest_votes (interest_id, voter_id, vote, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(interest_id, voter_id) DO UPDATE SET
       vote       = excluded.vote,
       created_at = excluded.created_at`,
    [interestId, voterId, vote, Date.now()],
  )
}

export async function listVotes(interestId: string): Promise<MowerInterestVote[]> {
  await ensureMigrated()
  const { rows } = await app.db.query<MowerInterestVoteRow>(
    'SELECT * FROM mower_interest_votes WHERE interest_id = ? ORDER BY created_at DESC',
    [interestId],
  )
  return rows.map(rowToVote)
}

export async function voteTally(interestId: string): Promise<{ up: number; down: number; score: number }> {
  await ensureMigrated()
  const { rows } = await app.db.query<{ up: number; down: number }>(
    `SELECT
       SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS up,
       SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS down
     FROM mower_interest_votes WHERE interest_id = ?`,
    [interestId],
  )
  const up = rows[0]?.up ?? 0
  const down = rows[0]?.down ?? 0
  return { up, down, score: up - down }
}
