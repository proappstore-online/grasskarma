import { ensureMigrated } from './db'
import { requireAuthenticatedCaller } from './caller'
import { ActionRefusedError, q, xOne, xBatch } from './actions'
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
  // Location lookup has the same trimmed, case-insensitive semantics as the
  // unique location index and duplicate-conflict lookup. Preserve display case
  // here; the registered action performs the case-insensitive comparison.
  const suburb = filter.suburb?.trim()
  const postcode = filter.postcode?.trim()
  // adminId / memberId are filtered here post-query because admin_ids/member_ids
  // are JSON arrays; the cost of the extra client pass is negligible.
  const rows = await q<StreetGroupRow>('list_groups', {
    status: filter.status ?? null,
    suburb: suburb || null,
    postcode: postcode || null,
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
}

export interface GroupLocation {
  streetName: string
  suburb: string
  postcode: string
}

type GroupLocationInput = {
  streetName?: string | null
  suburb?: string | null
  postcode?: string | null
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
export function validateAndNormalizeLocation(input: GroupLocationInput): GroupLocation
export function validateAndNormalizeLocation(input: GroupLocationInput, allowPartial: true): Partial<GroupLocation>
export function validateAndNormalizeLocation(input: GroupLocationInput, allowPartial = false): Partial<GroupLocation> {
  const normalized: Partial<GroupLocation> = {}
  const normalize = (field: keyof GroupLocation, message: string, value: string | null | undefined) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(message)
    normalized[field] = value.trim()
  }

  if (Object.hasOwn(input, 'streetName')) normalize('streetName', 'Street name is required to create or update a group.', input.streetName)
  else if (!allowPartial) throw new Error('Street name is required to create or update a group.')

  if (Object.hasOwn(input, 'suburb')) normalize('suburb', 'Suburb and 4-digit postcode are required to create or update a group.', input.suburb)
  else if (!allowPartial) throw new Error('Suburb and 4-digit postcode are required to create or update a group.')

  if (Object.hasOwn(input, 'postcode')) {
    if (typeof input.postcode !== 'string' || !/^\d{4}$/.test(input.postcode.trim())) {
      throw new Error('Suburb and 4-digit postcode are required to create or update a group.')
    }
    normalized.postcode = input.postcode.trim()
  } else if (!allowPartial) {
    throw new Error('Suburb and 4-digit postcode are required to create or update a group.')
  }

  return normalized
}

/** Backwards-compatible name for the complete-location create boundary. */
export function normalizeGroupLocation(input: Pick<GroupCreate, 'streetName' | 'suburb' | 'postcode'>): GroupLocation {
  return validateAndNormalizeLocation(input)
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
  const location = validateAndNormalizeLocation(input)
  const existing = await findGroupByLocation(location)
  if (existing) throw new GroupLocationConflictError(existing)

  const id = crypto.randomUUID()
  // The caller (`:__user_id`) is always the sole initial admin + member.
  try {
    await xBatch('create_group', {
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
  } catch (error) {
    // A concurrent create is a refusal, but expose the durable winner as the
    // existing location conflict rather than pretending this create succeeded.
    if (error instanceof ActionRefusedError) {
      const winner = await findGroupByLocation(location)
      if (winner) throw new GroupLocationConflictError(winner)
    }
    throw error
  }
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
  const locationPatch: GroupLocationInput = {}
  if ('streetName' in patch) locationPatch.streetName = patch.streetName
  if ('suburb' in patch) locationPatch.suburb = patch.suburb
  if ('postcode' in patch) locationPatch.postcode = patch.postcode
  const normalizedLocationPatch = validateAndNormalizeLocation(locationPatch, true)
  if (Object.keys(normalizedLocationPatch).length > 0) {
    // Validate the complete candidate at the model boundary. The registered
    // action repeats this check against the current row, which is the
    // authoritative race-safe decision.
    const current = await getGroup(id)
    if (!current) throw new Error('Street group was not found or is no longer accessible.')
    validateAndNormalizeLocation({
      streetName: normalizedLocationPatch.streetName ?? current.streetName,
      suburb: normalizedLocationPatch.suburb ?? current.suburb,
      postcode: normalizedLocationPatch.postcode ?? current.postcode,
    })
  }
  const params: Record<string, unknown> = { id }
  const set = (flag: string, col: string, val: unknown) => {
    params[flag] = 1
    params[col] = val
  }
  if ('name' in patch) set('set_name', 'name', patch.name)
  if ('streetName' in patch) set('set_street_name', 'street_name', normalizedLocationPatch.streetName)
  if ('suburb' in patch) set('set_suburb', 'suburb', normalizedLocationPatch.suburb)
  if ('postcode' in patch) set('set_postcode', 'postcode', normalizedLocationPatch.postcode)
  if ('state' in patch) set('set_state', 'state', patch.state ?? null)
  if ('country' in patch) set('set_country', 'country', patch.country ?? null)
  if ('centerLat' in patch) set('set_center_lat', 'center_lat', patch.centerLat ?? null)
  if ('centerLng' in patch) set('set_center_lng', 'center_lng', patch.centerLng ?? null)
  if ('status' in patch) set('set_status', 'status', patch.status)
  if ('assignedMowerId' in patch) set('set_assigned_mower_id', 'assigned_mower_id', patch.assignedMowerId ?? null)
  if (Object.keys(params).length === 1) return
  await xOne('update_group', params)
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  // The action guards + de-dupes in SQL (self-join, or a group/platform admin).
  await xBatch('add_group_member', { group_id: groupId, user_id: userId })
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await xBatch('remove_group_member', { group_id: groupId, user_id: userId })
}

export async function addAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await xOne('add_group_admin', { group_id: groupId, user_id: userId })
}

export async function removeAdmin(groupId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await xOne('remove_group_admin', { group_id: groupId, user_id: userId })
}

export async function deleteGroup(id: string): Promise<void> {
  await ensureMigrated()
  await xBatch('delete_group', { group_id: id })
}

// ---------------------------------------------------------------------------
// Interests (clients expressing interest in joining a group)
// ---------------------------------------------------------------------------

export async function createGroupInterest(groupId: string, message: string | null = null): Promise<StreetGroupInterest> {
  await ensureMigrated()
  const userId = requireAuthenticatedCaller()
  const id = crypto.randomUUID()
  const now = Date.now()
  // The applicant is always the verified caller (`:__user_id`).
  await xOne('create_group_interest', { id, group_id: groupId, message })
  return { id, groupId, userId, message, createdAt: now }
}

export async function listGroupInterests(groupId: string): Promise<StreetGroupInterest[]> {
  await ensureMigrated()
  const rows = await q<StreetGroupInterestRow>('list_group_interests', { group_id: groupId })
  return rows.map(rowToInterest)
}

export async function deleteGroupInterest(id: string): Promise<void> {
  await ensureMigrated()
  await xOne('delete_group_interest', { id })
}

/**
 * Accept a pending request in one data-worker transaction. This avoids the
 * misleading state where a request is removed but the applicant was not made
 * a member (or vice versa) if a later write fails.
 */
export async function approveGroupInterest(groupId: string, interestId: string, userId: string): Promise<void> {
  await ensureMigrated()
  await xBatch('approve_group_interest', { group_id: groupId, interest_id: interestId, user_id: userId })
}
