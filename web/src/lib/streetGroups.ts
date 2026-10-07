import { ensureMigrated } from './db'
import { q, x } from './actions'
import type { StreetGroupRow, StreetGroupInterestRow } from './db'
import type { StreetGroup, StreetGroupInterest, StreetGroupStatus } from '../models'

const STREET_GROUP_STATUSES = new Set<StreetGroupStatus>(['forming', 'active', 'paused', 'archived'])

/** D1 has the matching CHECK constraint; retain a readable model-boundary error. */
export function validateStreetGroupStatus(status: StreetGroupStatus): void {
  if (!STREET_GROUP_STATUSES.has(status)) {
    throw new Error('Street-group status must be forming, active, paused, or archived.')
  }
}

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
  streetName: string
  suburb: string
  postcode: string
  state?: string | null
  country?: string | null
  centerLat?: number | null
  centerLng?: number | null
  createdBy: string
}

export interface GroupLocation {
  streetName: string
  suburb: string
  postcode: string
}

/** Raised when D1's normalized location uniqueness invariant finds a group. */
export class GroupLocationConflictError extends Error {
  readonly existingGroup: StreetGroup

  constructor(existingGroup: StreetGroup) {
    super(`A street group already exists for ${existingGroup.streetName}, ${existingGroup.suburb} ${existingGroup.postcode}. Please request to join it.`)
    this.name = 'GroupLocationConflictError'
    this.existingGroup = existingGroup
  }
}

/**
 * Model-level counterpart to the D1 location index: required, trimmed fields.
 * Case is deliberately left intact for display; D1 compares with lower(trim()).
 */
export function normalizeGroupLocation(input: Pick<GroupCreate, 'streetName' | 'suburb' | 'postcode'>): GroupLocation {
  const streetName = input.streetName.trim()
  const suburb = input.suburb.trim()
  const postcode = input.postcode.trim()
  if (!streetName) throw new Error('Street name is required to create a group.')
  if (!suburb || !/^\d{4}$/.test(postcode)) throw new Error('Suburb and 4-digit postcode are required to create a group.')
  return { streetName, suburb, postcode }
}

async function findGroupByLocation(location: GroupLocation): Promise<StreetGroup | null> {
  const rows = await q<StreetGroupRow>('find_group_by_location', {
    street_name: location.streetName,
    suburb: location.suburb,
    postcode: location.postcode,
  })
  return rows[0] ? rowToGroup(rows[0]) : null
}

export async function createGroup(input: GroupCreate): Promise<StreetGroup> {
  await ensureMigrated()
  const location = normalizeGroupLocation(input)
  const existing = await findGroupByLocation(location)
  if (existing) throw new GroupLocationConflictError(existing)

  const id = crypto.randomUUID()
  // The caller (`:__user_id`) is always the sole initial admin + member —
  // `input.createdBy` is the caller's own id at every call site.
  await x('create_group', {
    id,
    name: input.name,
    street_name: location.streetName,
    suburb: location.suburb,
    postcode: location.postcode,
    state: input.state ?? null,
    country: input.country ?? null,
    center_lat: input.centerLat ?? null,
    center_lng: input.centerLng ?? null,
  })
  const g = await getGroup(id)
  if (g) return g

  // INSERT OR IGNORE turns a concurrent unique-index collision into a no-op.
  // Re-read the canonical row so the caller receives a conflict, never a raw
  // constraint exception or a misleading success response.
  const winner = await findGroupByLocation(location)
  if (winner) throw new GroupLocationConflictError(winner)
  throw new Error('Group was not created. Please try again.')
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
  if ('status' in patch && patch.status != null) validateStreetGroupStatus(patch.status)
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

/**
 * Accept a pending request in one data-worker transaction. This avoids the
 * misleading state where a request is removed but the applicant was not made
 * a member (or vice versa) if a later write fails.
 */
export async function approveGroupInterest(groupId: string, interestId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await x('approve_group_interest', { group_id: groupId, interest_id: interestId, user_id: userId })
}
