import { app } from './app'
import { ensureMigrated } from './db'
import type { StreetGroupRow, StreetGroupInterestRow } from './db'
import type { StreetGroup, StreetGroupInterest, StreetGroupStatus } from '../models'

function parseIds(s: string): string[] {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function rowToGroup(r: StreetGroupRow): StreetGroup {
  return {
    id: r.id,
    name: r.name,
    streetName: r.street_name,
    suburb: r.suburb,
    postcode: r.postcode,
    state: r.state,
    country: r.country,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    adminIds: parseIds(r.admin_ids),
    memberIds: parseIds(r.member_ids),
    assignedMowerId: r.assigned_mower_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToInterest(r: StreetGroupInterestRow): StreetGroupInterest {
  return {
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    message: r.message,
    createdAt: r.created_at,
  }
}

export interface GroupSearch {
  status?: StreetGroupStatus
  suburb?: string
  postcode?: string
  adminId?: string
  memberId?: string
  mowerId?: string
  limit?: number
}

export async function listGroups(filter: GroupSearch = {}): Promise<StreetGroup[]> {
  await ensureMigrated()
  const wheres: string[] = []
  const params: unknown[] = []
  if (filter.status) {
    wheres.push('status = ?')
    params.push(filter.status)
  }
  if (filter.suburb) {
    wheres.push('suburb = ?')
    params.push(filter.suburb)
  }
  if (filter.postcode) {
    wheres.push('postcode = ?')
    params.push(filter.postcode)
  }
  if (filter.mowerId) {
    wheres.push('assigned_mower_id = ?')
    params.push(filter.mowerId)
  }
  // For adminId / memberId we filter post-query because admin_ids/member_ids
  // are JSON arrays. SQLite has json_each but the cost of two filter passes is
  // negligible here.
  const sql = `SELECT * FROM street_groups ${wheres.length ? 'WHERE ' + wheres.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ?`
  params.push(filter.limit ?? 200)
  const { rows } = await app.db.query<StreetGroupRow>(sql, params)
  let out = rows.map(rowToGroup)
  if (filter.adminId) out = out.filter((g) => g.adminIds.includes(filter.adminId!))
  if (filter.memberId) out = out.filter((g) => g.memberIds.includes(filter.memberId!))
  return out
}

export async function getGroup(id: string): Promise<StreetGroup | null> {
  await ensureMigrated()
  const { rows } = await app.db.query<StreetGroupRow>('SELECT * FROM street_groups WHERE id = ?', [id])
  return rows[0] ? rowToGroup(rows[0]) : null
}

export interface GroupCreate {
  name: string
  streetName?: string | null
  suburb?: string | null
  postcode?: string | null
  state?: string | null
  country?: string | null
  centerLat?: number | null
  centerLng?: number | null
  createdBy: string
}

export async function createGroup(input: GroupCreate): Promise<StreetGroup> {
  await ensureMigrated()
  const id = crypto.randomUUID()
  const now = Date.now()
  const ids = JSON.stringify([input.createdBy])
  await app.db.execute(
    `INSERT INTO street_groups (id, name, street_name, suburb, postcode, state, country, center_lat, center_lng, admin_ids, member_ids, assigned_mower_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'forming', ?, ?)`,
    [
      id,
      input.name,
      input.streetName ?? null,
      input.suburb ?? null,
      input.postcode ?? null,
      input.state ?? null,
      input.country ?? null,
      input.centerLat ?? null,
      input.centerLng ?? null,
      ids,
      ids,
      now,
      now,
    ],
  )
  const g = await getGroup(id)
  if (!g) throw new Error('Group not found after create')
  return g
}

export interface GroupPatch {
  name?: string
  streetName?: string | null
  suburb?: string | null
  postcode?: string | null
  state?: string | null
  country?: string | null
  centerLat?: number | null
  centerLng?: number | null
  status?: StreetGroupStatus
  assignedMowerId?: string | null
}

export async function updateGroup(id: string, patch: GroupPatch): Promise<void> {
  await ensureMigrated()
  const sets: string[] = []
  const params: unknown[] = []
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`)
    params.push(val)
  }
  if ('name' in patch) push('name', patch.name)
  if ('streetName' in patch) push('street_name', patch.streetName ?? null)
  if ('suburb' in patch) push('suburb', patch.suburb ?? null)
  if ('postcode' in patch) push('postcode', patch.postcode ?? null)
  if ('state' in patch) push('state', patch.state ?? null)
  if ('country' in patch) push('country', patch.country ?? null)
  if ('centerLat' in patch) push('center_lat', patch.centerLat ?? null)
  if ('centerLng' in patch) push('center_lng', patch.centerLng ?? null)
  if ('status' in patch) push('status', patch.status)
  if ('assignedMowerId' in patch) push('assigned_mower_id', patch.assignedMowerId ?? null)
  if (sets.length === 0) return
  push('updated_at', Date.now())
  await app.db.execute(`UPDATE street_groups SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  const g = await getGroup(groupId)
  if (!g) throw new Error('Group not found')
  if (g.memberIds.includes(userId)) return
  await app.db.execute('UPDATE street_groups SET member_ids = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify([...g.memberIds, userId]),
    Date.now(),
    groupId,
  ])
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  const g = await getGroup(groupId)
  if (!g) return
  const next = g.memberIds.filter((id) => id !== userId)
  await app.db.execute('UPDATE street_groups SET member_ids = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(next),
    Date.now(),
    groupId,
  ])
}

export async function addAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  const g = await getGroup(groupId)
  if (!g) throw new Error('Group not found')
  if (g.adminIds.includes(userId)) return
  await app.db.execute('UPDATE street_groups SET admin_ids = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify([...g.adminIds, userId]),
    Date.now(),
    groupId,
  ])
}

export async function removeAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  const g = await getGroup(groupId)
  if (!g) return
  const next = g.adminIds.filter((id) => id !== userId)
  await app.db.execute('UPDATE street_groups SET admin_ids = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(next),
    Date.now(),
    groupId,
  ])
}

export async function deleteGroup(id: string): Promise<void> {
  await ensureMigrated()
  await app.db.batch([
    { sql: 'DELETE FROM schedules WHERE group_id = ?', params: [id] },
    { sql: 'DELETE FROM street_group_interests WHERE group_id = ?', params: [id] },
    { sql: 'DELETE FROM mower_interest_votes WHERE interest_id IN (SELECT id FROM mower_interests WHERE group_id = ?)', params: [id] },
    { sql: 'DELETE FROM mower_interests WHERE group_id = ?', params: [id] },
    { sql: 'DELETE FROM street_groups WHERE id = ?', params: [id] },
  ])
}

// ---------------------------------------------------------------------------
// Interests (clients expressing interest in joining a group)
// ---------------------------------------------------------------------------

export async function createGroupInterest(groupId: string, userId: string, message: string | null = null): Promise<StreetGroupInterest> {
  await ensureMigrated()
  const id = crypto.randomUUID()
  const now = Date.now()
  await app.db.execute(
    `INSERT OR REPLACE INTO street_group_interests (id, group_id, user_id, message, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, groupId, userId, message, now],
  )
  return { id, groupId, userId, message, createdAt: now }
}

export async function listGroupInterests(groupId: string): Promise<StreetGroupInterest[]> {
  await ensureMigrated()
  const { rows } = await app.db.query<StreetGroupInterestRow>(
    'SELECT * FROM street_group_interests WHERE group_id = ? ORDER BY created_at DESC',
    [groupId],
  )
  return rows.map(rowToInterest)
}

export async function deleteGroupInterest(id: string): Promise<void> {
  await ensureMigrated()
  await app.db.execute('DELETE FROM street_group_interests WHERE id = ?', [id])
}
