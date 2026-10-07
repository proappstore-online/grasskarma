import { app } from './app'
import { ensureMigrated } from './db'
import { q, xOne, xBatch } from './actions'
import type { UserRow } from './db'
import type { User, Role, ClientProfile, MowerProfile } from '../models'
import { getPublicMowerContact } from './mowerContacts'

function parseJson<T>(s: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id,
    publicContactEmail: r.public_contact_email,
    email: r.email,
    name: r.name,
    photoUrl: r.photo_url,
    role: r.role,
    suburb: r.suburb,
    postcode: r.postcode,
    state: r.state,
    country: r.country,
    lat: r.lat,
    lng: r.lng,
    clientProfile: parseJson<ClientProfile>(r.client_profile),
    mowerProfile: parseJson<MowerProfile>(r.mower_profile),
    streetGroupId: r.street_group_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function getMe(): Promise<User | null> {
  await ensureMigrated()
  const u = app.auth.user
  if (!u) return null
  return getUser(u.id)
}

export async function getUser(id: string): Promise<User | null> {
  await ensureMigrated()
  const rows = await q<UserRow>('get_user', { id })
  if (!rows[0]) return null
  const user = rowToUser(rows[0])
  // This query exposes only the mower's explicit opt-in address; it never
  // falls back to the masked account email returned by get_user.
  if (user.role === 'mower') user.publicContactEmail = await getPublicMowerContact(id)
  return user
}

export interface UserSearch {
  role?: Role
  suburb?: string
  postcode?: string
  limit?: number
}

export async function listUsers(filter: UserSearch = {}): Promise<User[]> {
  await ensureMigrated()
  const rows = await q<UserRow>('list_users', {
    role: filter.role ?? null,
    suburb: filter.suburb ?? null,
    postcode: filter.postcode ?? null,
    limit: filter.limit ?? 100,
  })
  return rows.map(rowToUser)
}

export interface UserCreate {
  id: string
  publicContactEmail?: string | null
  email?: string | null
  name?: string | null
  photoUrl?: string | null
  role: Role
  suburb?: string | null
  postcode?: string | null
  state?: string | null
  country?: string | null
  lat?: number | null
  lng?: number | null
  clientProfile?: ClientProfile | null
  mowerProfile?: MowerProfile | null
}

export async function createUser(input: UserCreate): Promise<User> {
  await ensureMigrated()
  // `id` is ignored server-side — the row is always keyed to the verified
  // caller (`:__user_id`). `input.id` is the caller's own id at every call site.
  await xOne('create_me', {
    email: input.email ?? null,
    name: input.name ?? null,
    photo_url: input.photoUrl ?? null,
    role: input.role,
    suburb: input.suburb ?? null,
    postcode: input.postcode ?? null,
    state: input.state ?? null,
    country: input.country ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    client_profile: input.clientProfile ? JSON.stringify(input.clientProfile) : null,
    mower_profile: input.mowerProfile ? JSON.stringify(input.mowerProfile) : null,
  })
  const u = await getUser(input.id)
  if (!u) throw new Error('User not found after create')
  return u
}

// Roles are deliberately absent: only the server-guarded adminSetRole action
// may change one. A caller may point to a group only after the action verifies
// their membership server-side.
export type UserPatch = Partial<Omit<UserCreate, 'id' | 'role'>> & { streetGroupId?: string | null }

// `id` is accepted for signature stability but the write always targets the
// verified caller's own row (`:__user_id`) — every call site passes `user.id`.
export async function updateUser(_id: string, patch: UserPatch): Promise<void> {
  await ensureMigrated()
  const params: Record<string, unknown> = {}
  const set = (flag: string, col: string, val: unknown) => {
    params[flag] = 1
    params[col] = val
  }
  if ('email' in patch) set('set_email', 'email', patch.email ?? null)
  if ('publicContactEmail' in patch) set('set_public_contact_email', 'public_contact_email', patch.publicContactEmail ?? null)
  if ('name' in patch) set('set_name', 'name', patch.name ?? null)
  if ('photoUrl' in patch) set('set_photo_url', 'photo_url', patch.photoUrl ?? null)
  if ('suburb' in patch) set('set_suburb', 'suburb', patch.suburb ?? null)
  if ('postcode' in patch) set('set_postcode', 'postcode', patch.postcode ?? null)
  if ('state' in patch) set('set_state', 'state', patch.state ?? null)
  if ('country' in patch) set('set_country', 'country', patch.country ?? null)
  if ('lat' in patch) set('set_lat', 'lat', patch.lat ?? null)
  if ('lng' in patch) set('set_lng', 'lng', patch.lng ?? null)
  if ('clientProfile' in patch) set('set_client_profile', 'client_profile', patch.clientProfile ? JSON.stringify(patch.clientProfile) : null)
  if ('mowerProfile' in patch) set('set_mower_profile', 'mower_profile', patch.mowerProfile ? JSON.stringify(patch.mowerProfile) : null)
  if ('streetGroupId' in patch) set('set_street_group_id', 'street_group_id', patch.streetGroupId ?? null)
  if (Object.keys(params).length === 0) return
  await xOne('update_me', params)
}

// Admin operations — the registered actions enforce that the caller is a
// platform admin (users.role = 'admin'); a non-admin gets 0 changes.

export async function adminSetRole(userId: string, role: Role): Promise<void> {
  await ensureMigrated()
  await xOne('admin_set_role', { user_id: userId, role })
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await ensureMigrated()
  await xBatch('admin_delete_user', { user_id: userId })
}

// The action binds `user_id` to the verified caller when used here. It shares
// the full transactional cleanup path with administrator deletions while
// keeping normal users unable to target any other account.
export async function deleteOwnAccount(photoKeys: string[] = []): Promise<void> {
  await ensureMigrated()
  const userId = app.auth.user?.id
  if (!userId) throw new Error('Not signed in')
  // The action copies all tracked objects to the durable cleanup queue in the
  // same transaction as the account deletion. `photoKeys` covers legacy URLs
  // from before tracking was introduced.
  await xBatch('admin_delete_user', { user_id: userId, photo_keys: JSON.stringify(photoKeys) })
}
