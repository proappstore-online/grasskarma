import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  xOne: vi.fn(),
  xBatch: vi.fn(),
}))

vi.mock('./app', () => ({ app: { db: { migrate: mocks.migrate }, auth: { user: { id: 'caller' } } } }))
vi.mock('./actions', () => ({
  q: vi.fn(),
  xOne: mocks.xOne,
  xBatch: mocks.xBatch,
  ActionRefusedError: class ActionRefusedError extends Error {},
}))

import { adminDeleteUser, adminSetRole } from './users'
import { addMember, approveGroupInterest, updateGroup } from './streetGroups'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.migrate.mockResolvedValue(undefined)
  mocks.xOne.mockResolvedValue({ changes: 1 })
  mocks.xBatch.mockResolvedValue({ changes: 1 })
})

describe('protected mutation wrappers', () => {
  it('surfaces a stale admin role change instead of reporting success', async () => {
    mocks.xOne.mockRejectedValueOnce(new Error('admin_set_role was refused by the server.'))

    await expect(adminSetRole('member', 'mower')).rejects.toThrow('refused')
    expect(mocks.xOne).toHaveBeenCalledWith('admin_set_role', { user_id: 'member', role: 'mower' })
  })

  it('uses the explicit final-statement batch contract for account deletion', async () => {
    mocks.xBatch.mockRejectedValueOnce(new Error('admin_delete_user was refused by the server.'))

    await expect(adminDeleteUser('departed')).rejects.toThrow('refused')
    expect(mocks.xBatch).toHaveBeenCalledWith('admin_delete_user', { user_id: 'departed' })
  })

  it('does not turn stale group authority or rows into successful membership changes', async () => {
    mocks.xOne.mockRejectedValueOnce(new Error('update_group was refused by the server.'))
    await expect(updateGroup('group', { status: 'active' })).rejects.toThrow('refused')

    mocks.xBatch.mockRejectedValueOnce(new Error('add_group_member was refused by the server.'))
    await expect(addMember('group', 'member')).rejects.toThrow('refused')

    mocks.xBatch.mockRejectedValueOnce(new Error('approve_group_interest was refused by the server.'))
    await expect(approveGroupInterest('group', 'request', 'member')).rejects.toThrow('refused')
  })
})
