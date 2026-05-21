import { app } from './app'

// Avatars / lawn photos are uploaded to R2 via `app.storage.uploadPublic` so
// they can be rendered in <img src> without an auth header. The returned URL
// is stored on the user row as `photoUrl` directly.

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `avatars/${userId}/${Date.now()}.${ext}`
  await app.storage.uploadPublic(path, file, file.type || 'image/jpeg')
  return app.storage.publicUrl(path)
}

export async function uploadLawnPhoto(userId: string, kind: 'before' | 'after', file: File): Promise<string> {
  const ts = Date.now()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `lawns/${userId}/${kind}-${ts}.${ext}`
  await app.storage.uploadPublic(path, file, file.type || 'image/jpeg')
  return app.storage.publicUrl(path)
}

/**
 * Best-effort delete for a photo. Accepts either a public URL or a raw
 * storage key. Silently ignores third-party URLs.
 */
export async function deletePhoto(urlOrKey: string): Promise<void> {
  try {
    if (urlOrKey.startsWith('http')) {
      const parsed = new URL(urlOrKey)
      const m = parsed.pathname.match(/^\/v1\/apps\/[^/]+\/public\/(.+)$/)
      if (!m) return
      await app.storage.delete(`_public/${m[1]}`)
    } else {
      await app.storage.delete(urlOrKey)
    }
  } catch {
    // orphan R2 objects are cheaper than blocking a remove
  }
}
