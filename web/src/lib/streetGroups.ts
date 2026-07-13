import { ensureMigrated } from './db'
import { q, x } from './actions'
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
  // status/suburb/postcode/mowerId are filtered in the registered action.
  // adminId / memberId are filtered here post-query because admin_ids/member_ids
  // are JSON arrays; the cost of the extra client pass is negligible.
  const rows = await q<StreetGroupRow>('list_groups', {
    status: filter.status ?? null,
    suburb: filter.suburb ?? null,
    postcode: filter.postcode ?? null,
    mower_id: filter.mowerId ?? null,
    limit: filter.limit ?? 200,
  })
  let out = rows.map(rowToGroup)
  if (filter.adminId) out = out.filter((g) => g.adminIds.includes(filter.adminId!))
  if (filter.memberId) out = out.filter((g) => g.memberIds.includes(filter.memberId!))
  return out
}

export async function getGroup(id: string): Promise<StreetGroup | null> {
  await ensureMigrated()
  const rows = await q<StreetGroupRow>('get_group', { id })
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
  // The caller (`:__user_id`) is always the sole initial admin + member —
  // `input.createdBy` is the caller's own id at every call site.
  await x('create_group', {
    id,
    name: input.name,
    street_name: input.streetName ?? null,
    suburb: input.suburb ?? null,
    postcode: input.postcode ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    center_lat: input.centerLat ?? null,
    center_lng: input.centerLng ?? null,
  })
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
  const params: Record<string, unknown> = { id }
  const set = (flag: string, col: string, val: unknown) => {
    params[flag] = 1
    params[col] = val
  }
  if ('name' in patch) set('set_name', 'name', patch.name)
  if ('streetName' in patch) set('set_street_name', 'street_name', patch.streetName ?? null)
  if ('suburb' in patch) set('set_suburb', 'suburb', patch.suburb ?? null)
  if ('postcode' in patch) set('set_postcode', 'postcode', patch.postcode ?? null)
  if ('state' in patch) set('set_state', 'state', patch.state ?? null)
  if ('country' in patch) set('set_country', 'country', patch.country ?? null)
  if ('centerLat' in patch) set('set_center_lat', 'center_lat', patch.centerLat ?? null)
  if ('centerLng' in patch) set('set_center_lng', 'center_lng', patch.centerLng ?? null)
  if ('status' in patch) set('set_status', 'status', patch.status)
  if ('assignedMowerId' in patch) set('set_assigned_mower_id', 'assigned_mower_id', patch.assignedMowerId ?? null)
  if (Object.keys(params).length === 1) return
  await x('update_group', params)
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  // The action guards + de-dupes in SQL (self-join, or a group/platform admin).
  await x('add_group_member', { group_id: groupId, user_id: userId })
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await x('remove_group_member', { group_id: groupId, user_id: userId })
}

export async function addAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await x('add_group_admin', { group_id: groupId, user_id: userId })
}

export async function removeAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await x('remove_group_admin', { group_id: groupId, user_id: userId })
}

export async function deleteGroup(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_group', { group_id: id })
}

// ---------------------------------------------------------------------------
// Interests (clients expressing interest in joining a group)
// ---------------------------------------------------------------------------

export async function createGroupInterest(groupId: string, userId: string, message: string | null = null): Promise<StreetGroupInterest> {
  await ensureMigrated()
  const id = crypto.randomUUID()
  const now = Date.now()
  // The applicant is always the verified caller (`:__user_id`); `userId` is the
  // caller's own id at every call site.
  await x('create_group_interest', { id, group_id: groupId, message })
  return { id, groupId, userId, message, createdAt: now }
}

export async function listGroupInterests(groupId: string): Promise<StreetGroupInterest[]> {
  await ensureMigrated()
  const rows = await q<StreetGroupInterestRow>('list_group_interests', { group_id: groupId })
  return rows.map(rowToInterest)
}

export async function deleteGroupInterest(id: string): Promise<void> {
  await ensureMigrated()
  await x('delete_group_interest', { id })
}
