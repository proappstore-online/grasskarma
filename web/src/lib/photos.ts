import { app } from './app'

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const key = `avatars/${userId}.${ext}`
  await app.storage.upload(key, file, file.type || 'image/jpeg')
  return key
}

export async function uploadLawnPhoto(userId: string, kind: 'before' | 'after', file: File): Promise<string> {
  const ts = Date.now()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const key = `lawns/${userId}/${kind}-${ts}.${ext}`
  await app.storage.upload(key, file, file.type || 'image/jpeg')
  return key
}

export async function deletePhoto(key: string): Promise<void> {
  await app.storage.delete(key)
}
