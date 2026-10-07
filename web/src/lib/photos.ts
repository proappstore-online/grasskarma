import { app } from './app'
import { q, x } from './actions'
import { updateUser } from './users'

// Avatars / lawn photos use `app.storage.uploadUserPublic`, which gives each
// caller an enforced `u/<user-id>/` namespace while keeping the resulting URL
// renderable in <img>. The cleanup ledger records these otherwise-independent
// R2 objects before a database row starts referring to them.

function requireCaller(userId: string): string {
  const caller = app.auth.user
  if (!caller) throw new Error('Not signed in')
  if (caller.id !== userId) throw new Error('Cannot manage another user\'s photos')
  return caller.id
}

function isCallerPhotoKey(key: string, callerId: string): boolean {
  // The first two variants are legacy app-public paths. New files use
  // uploadUserPublic(), whose `u/<id>/` namespace is enforced by PAS.
  return key.startsWith(`u/${callerId}/avatars/`)
    || key.startsWith(`u/${callerId}/lawns/`)
    || key.startsWith(`avatars/${callerId}/`)
    || key.startsWith(`lawns/${callerId}/`)
}

function keyFromUrl(urlOrKey: string): string | null {
  if (!urlOrKey.startsWith('http')) return urlOrKey.replace(/^_public\//, '')
  const parsed = new URL(urlOrKey)
  const match = parsed.pathname.match(/^\/v1\/apps\/[^/]+\/public\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function userPublicPath(key: string, callerId: string): string | null {
  const prefix = `u/${callerId}/`
  return key.startsWith(prefix) ? key.slice(prefix.length) : null
}

async function recordPhoto(key: string): Promise<void> {
  await x('record_photo_object', { storage_key: key })
}

async function uploadPhoto(userId: string, category: 'avatars' | 'lawns', name: string, file: File): Promise<string> {
  const callerId = requireCaller(userId)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const result = await app.storage.uploadUserPublic(`${category}/${name}-${crypto.randomUUID()}.${ext}`, file, file.type || 'image/jpeg')
  if (!isCallerPhotoKey(result.key, callerId)) throw new Error('Storage returned an unexpected photo key')
  try {
    await recordPhoto(result.key)
  } catch (error) {
    // If it cannot be tracked, make a best effort to avoid creating an
    // uncollectable object, then surface the failure to the caller.
    await deletePhoto(result.key).catch(() => undefined)
    throw error
  }
  return app.storage.publicUrl(result.key)
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  return uploadPhoto(userId, 'avatars', 'avatar', file)
}

export async function uploadLawnPhoto(userId: string, kind: 'before' | 'after', file: File): Promise<string> {
  return uploadPhoto(userId, 'lawns', kind, file)
}

/**
 * Delete a caller-owned photo. Unlike the old best-effort helper, ownership
 * errors are surfaced and a foreign URL never reaches the storage API.
 */
export async function deletePhoto(urlOrKey: string): Promise<void> {
  const caller = app.auth.user
  if (!caller) throw new Error('Not signed in')
  const callerId = caller.id
  const key = keyFromUrl(urlOrKey)
  if (!key || !isCallerPhotoKey(key, callerId)) throw new Error('Cannot delete another user\'s photos')
  const path = userPublicPath(key, callerId)
  await app.storage.delete(path ? `_userpub/${path}` : `_public/${key}`)
}

export function ownedPhotoKey(urlOrKey: string | null | undefined, userId: string): string | null {
  if (!urlOrKey) return null
  const key = keyFromUrl(urlOrKey)
  return key && isCallerPhotoKey(key, userId) ? key : null
}

export async function queuePhotoCleanup(keys: Array<string | null | undefined>): Promise<void> {
  const caller = app.auth.user
  if (!caller) throw new Error('Not signed in')
  const owned = keys.map((key) => key && ownedPhotoKey(key, caller.id)).filter((key): key is string => Boolean(key))
  if (owned.length === 0) return
  await x('queue_photo_cleanup', { storage_keys: JSON.stringify([...new Set(owned)]) })
}

/** Retry durable cleanup jobs. A failed delete stays queued; a successful
 * delete is acknowledged atomically with removal from the object ledger. */
export async function drainPendingPhotoCleanup(): Promise<void> {
  const caller = app.auth.user
  if (!caller) return
  const jobs = await q<{ storage_key: string }>('list_photo_cleanup_jobs')
  for (const { storage_key: key } of jobs) {
    try {
      await deletePhoto(key)
      await x('complete_photo_cleanup', { storage_key: key })
    } catch (error) {
      console.warn('Photo cleanup will be retried', error)
    }
  }
}

/** Persist the new avatar reference before queuing/deleting the old object. */
export async function replaceAvatar(userId: string, oldUrl: string | null, file: File): Promise<string> {
  const url = await uploadAvatar(userId, file)
  try {
    await updateUser(userId, { photoUrl: url })
  } catch (error) {
    await queuePhotoCleanup([url]).catch(() => undefined)
    void drainPendingPhotoCleanup()
    throw error
  }
  const oldKey = ownedPhotoKey(oldUrl, userId)
  if (oldKey) {
    await queuePhotoCleanup([oldKey])
    await drainPendingPhotoCleanup()
  }
  return url
}
