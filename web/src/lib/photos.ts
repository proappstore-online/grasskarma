import { app } from './app'

// Avatars / lawn photos are uploaded to R2 via `app.storage.uploadPublic` so
// they can be rendered in <img src> without an auth header. The returned URL
// is stored on the user row as `photoUrl` directly. The platform verifies the
// session for storage calls; these wrappers additionally make user-owned paths
// non-forgeable from application code.

function requireCaller(userId: string): string {
  const caller = app.auth.user
  if (!caller) throw new Error('Not signed in')
  if (caller.id !== userId) throw new Error('Cannot manage another user\'s photos')
  return caller.id
}

function isCallerPhotoKey(key: string, callerId: string): boolean {
  return key.startsWith(`avatars/${callerId}/`) || key.startsWith(`lawns/${callerId}/`)
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const callerId = requireCaller(userId)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `avatars/${callerId}/${Date.now()}.${ext}`
  await app.storage.uploadPublic(path, file, file.type || 'image/jpeg')
  return app.storage.publicUrl(path)
}

export async function uploadLawnPhoto(userId: string, kind: 'before' | 'after', file: File): Promise<string> {
  const callerId = requireCaller(userId)
  const ts = Date.now()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `lawns/${callerId}/${kind}-${ts}.${ext}`
  await app.storage.uploadPublic(path, file, file.type || 'image/jpeg')
  return app.storage.publicUrl(path)
}

/**
 * Best-effort delete for a photo. Accepts either a public URL or a raw
 * storage key. Silently ignores third-party URLs.
 */
export async function deletePhoto(urlOrKey: string): Promise<void> {
  try {
    const caller = app.auth.user
    if (!caller) throw new Error('Not signed in')
    let key = urlOrKey
    if (urlOrKey.startsWith('http')) {
      const parsed = new URL(urlOrKey)
      const m = parsed.pathname.match(/^\/v1\/apps\/[^/]+\/public\/(.+)$/)
      if (!m) return
      key = m[1]
    }
    key = key.replace(/^_public\//, '')
    if (!isCallerPhotoKey(key, caller.id)) throw new Error('Cannot delete another user\'s photos')
    await app.storage.delete(`_public/${key}`)
  } catch {
    // orphan R2 objects are cheaper than blocking a remove
  }
}
