import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  uploadUserPublic: vi.fn(),
  publicUrl: vi.fn(),
  q: vi.fn(),
  x: vi.fn(),
  updateUser: vi.fn(),
  user: { id: 'alice' } as { id: string } | null,
}))

vi.mock('./app', () => ({
  app: {
    auth: { get user() { return mocks.user } },
    storage: {
      delete: mocks.delete,
      uploadUserPublic: mocks.uploadUserPublic,
      publicUrl: mocks.publicUrl,
    },
  },
}))
vi.mock('./actions', () => ({ q: mocks.q, x: mocks.x }))
vi.mock('./users', () => ({ updateUser: mocks.updateUser }))

import { deletePhoto, drainPendingPhotoCleanup, replaceAvatar } from './photos'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: 'alice' }
  mocks.publicUrl.mockImplementation((key: string) => `https://api.example/v1/apps/grasskarma/public/${key}`)
  mocks.uploadUserPublic.mockResolvedValue({ key: 'u/alice/avatars/avatar-new.png' })
  mocks.x.mockResolvedValue({ changes: 1 })
  mocks.updateUser.mockResolvedValue(undefined)
  mocks.q.mockResolvedValue([])
})

describe('photo retention cleanup', () => {
  it('persists a replacement avatar before deleting its old object', async () => {
    const events: string[] = []
    mocks.x.mockImplementation(async (name: string) => { events.push(`action:${name}`); return { changes: 1 } })
    mocks.updateUser.mockImplementation(async () => { events.push('persist:new-reference') })
    mocks.q.mockImplementation(async () => { events.push('read:queue'); return [{ storage_key: 'u/alice/avatars/old.png' }] })
    mocks.delete.mockImplementation(async () => { events.push('storage:delete-old') })

    await replaceAvatar(
      'alice',
      'https://api.example/v1/apps/grasskarma/public/u/alice/avatars/old.png',
      { name: 'new.png', type: 'image/png' } as File,
    )

    expect(events.indexOf('persist:new-reference')).toBeGreaterThan(events.indexOf('action:record_photo_object'))
    expect(events.indexOf('storage:delete-old')).toBeGreaterThan(events.indexOf('persist:new-reference'))
    expect(mocks.delete).toHaveBeenCalledWith('_userpub/avatars/old.png')
    expect(mocks.x).toHaveBeenCalledWith('complete_photo_cleanup', { storage_key: 'u/alice/avatars/old.png' })
  })

  it('refuses to send another user’s object to storage', async () => {
    await expect(deletePhoto('u/bob/avatars/private.png')).rejects.toThrow('Cannot delete another user')
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('keeps failed cleanup queued and completes it on an idempotent retry', async () => {
    mocks.q.mockResolvedValue([{ storage_key: 'u/alice/lawns/before.png' }])
    mocks.delete.mockRejectedValueOnce(new Error('temporary storage error')).mockResolvedValueOnce(undefined)

    await drainPendingPhotoCleanup()
    expect(mocks.x).not.toHaveBeenCalledWith('complete_photo_cleanup', expect.anything())

    await drainPendingPhotoCleanup()
    expect(mocks.delete).toHaveBeenCalledTimes(2)
    expect(mocks.x).toHaveBeenCalledWith('complete_photo_cleanup', { storage_key: 'u/alice/lawns/before.png' })
  })
})
