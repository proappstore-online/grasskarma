import { app } from './app'
import { ensureMigrated } from './db'
import type { UserRow } from './db'
import type { User, Role, ClientProfile, MowerProfile } from '../models'

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
  const { rows } = await app.db.query<UserRow>('SELECT * FROM users WHERE id = ?', [id])
  return rows[0] ? rowToUser(rows[0]) : null
}

export interface UserSearch {
  role?: Role
  suburb?: string
  postcode?: string
  limit?: number
}

export async function listUsers(filter: UserSearch = {}): Promise<User[]> {
  await ensureMigrated()
  const wheres: string[] = []
  const params: unknown[] = []
  if (filter.role) {
    wheres.push('role = ?')
    params.push(filter.role)
  }
  if (filter.suburb) {
    wheres.push('suburb = ?')
    params.push(filter.suburb)
  }
  if (filter.postcode) {
    wheres.push('postcode = ?')
    params.push(filter.postcode)
  }
  const sql = `SELECT * FROM users ${wheres.length ? 'WHERE ' + wheres.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT ?`
  params.push(filter.limit ?? 100)
  const { rows } = await app.db.query<UserRow>(sql, params)
  return rows.map(rowToUser)
}

export interface UserCreate {
  id: string
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
  const now = Date.now()
  await app.db.execute(
    `INSERT INTO users (id, email, name, photo_url, role, suburb, postcode, state, country, lat, lng, client_profile, mower_profile, street_group_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      input.id,
      input.email ?? null,
      input.name ?? null,
      input.photoUrl ?? null,
      input.role,
      input.suburb ?? null,
      input.postcode ?? null,
      input.state ?? null,
      input.country ?? null,
      input.lat ?? null,
      input.lng ?? null,
      input.clientProfile ? JSON.stringify(input.clientProfile) : null,
      input.mowerProfile ? JSON.stringify(input.mowerProfile) : null,
      now,
      now,
    ],
  )
  const u = await getUser(input.id)
  if (!u) throw new Error('User not found after create')
  return u
}

export type UserPatch = Partial<Omit<UserCreate, 'id'>> & { streetGroupId?: string | null }

export async function updateUser(id: string, patch: UserPatch): Promise<void> {
  await ensureMigrated()
  const sets: string[] = []
  const params: unknown[] = []
  const push = (col: string, val: unknown) => {
    sets.push(`${col} = ?`)
    params.push(val)
  }
  if ('email' in patch) push('email', patch.email ?? null)
  if ('name' in patch) push('name', patch.name ?? null)
  if ('photoUrl' in patch) push('photo_url', patch.photoUrl ?? null)
  if ('role' in patch) push('role', patch.role)
  if ('suburb' in patch) push('suburb', patch.suburb ?? null)
  if ('postcode' in patch) push('postcode', patch.postcode ?? null)
  if ('state' in patch) push('state', patch.state ?? null)
  if ('country' in patch) push('country', patch.country ?? null)
  if ('lat' in patch) push('lat', patch.lat ?? null)
  if ('lng' in patch) push('lng', patch.lng ?? null)
  if ('clientProfile' in patch) push('client_profile', patch.clientProfile ? JSON.stringify(patch.clientProfile) : null)
  if ('mowerProfile' in patch) push('mower_profile', patch.mowerProfile ? JSON.stringify(patch.mowerProfile) : null)
  if ('streetGroupId' in patch) push('street_group_id', patch.streetGroupId ?? null)
  if (sets.length === 0) return
  push('updated_at', Date.now())
  await app.db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

// UI-only admin operations — see port plan §0 for the security caveat.
// A signed-in non-admin user can in principle craft these SQL calls
// themselves; v1 trusts that they don't. Server-side enforcement waits for
// the platform.

export async function adminSetRole(userId: string, role: Role): Promise<void> {
  await ensureMigrated()
  await app.db.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, Date.now(), userId])
}

export async function adminDeleteUser(userId: string): Promise<void> {
  await ensureMigrated()
  await app.db.execute('DELETE FROM users WHERE id = ?', [userId])
}
