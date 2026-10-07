import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  q: vi.fn(),
  xOne: vi.fn(),
  xBatch: vi.fn(),
}))

vi.mock('./app', () => ({ app: { db: { migrate: mocks.migrate }, auth: { user: { id: 'caller' } } } }))
vi.mock('./actions', () => ({
  q: mocks.q,
  xOne: mocks.xOne,
  xBatch: mocks.xBatch,
  ActionRefusedError: class ActionRefusedError extends Error {},
}))

import { adminDeleteUser, adminSetRole } from './users'
import { addMember, approveGroupInterest, updateGroup } from './streetGroups'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.migrate.mockResolvedValue(undefined)
  mocks.q.mockResolvedValue([])
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

describe('updateGroup location validation', () => {
  const currentGroup = {
    id: 'group', name: 'Maple Street', street_name: 'Maple Street', suburb: 'North Melbourne', postcode: '3000',
    state: null, country: null, center_lat: null, center_lng: null, admin_ids: '["caller"]', member_ids: '["caller"]',
    assigned_mower_id: null, status: 'forming', created_at: 1, updated_at: 1,
  }

  it.each([null, undefined])('rejects a null or undefined street name before writing', async (streetName) => {
    await expect(updateGroup('group', { streetName })).rejects.toThrow('Street name is required')
    expect(mocks.xOne).not.toHaveBeenCalled()
  })

  it('rejects a blank street name before writing', async () => {
    await expect(updateGroup('group', { streetName: '  ' })).rejects.toThrow('Street name is required')
    expect(mocks.xOne).not.toHaveBeenCalled()
  })

  it.each([null, undefined, '   '])('rejects a null, undefined, or blank suburb before writing', async (suburb) => {
    await expect(updateGroup('group', { suburb })).rejects.toThrow('Suburb and 4-digit postcode')
    expect(mocks.xOne).not.toHaveBeenCalled()
  })

  it.each(['123', '12345', 'abcd', ''])('rejects an invalid postcode before writing', async (postcode) => {
    await expect(updateGroup('group', { postcode })).rejects.toThrow('4-digit postcode')
    expect(mocks.xOne).not.toHaveBeenCalled()
  })

  it('trims padded location fields before submitting a valid update', async () => {
    mocks.q.mockResolvedValueOnce([currentGroup])

    await updateGroup('group', { streetName: '  Collins Street  ', suburb: '  Melbourne  ', postcode: ' 3000 ' })

    expect(mocks.xOne).toHaveBeenCalledWith('update_group', {
      id: 'group',
      set_street_name: 1,
      street_name: 'Collins Street',
      set_suburb: 1,
      suburb: 'Melbourne',
      set_postcode: 1,
      postcode: '3000',
    })
  })

  it('accepts a fully valid location update', async () => {
    mocks.q.mockResolvedValueOnce([currentGroup])

    await expect(updateGroup('group', { streetName: 'Brunswick Road', suburb: 'Brunswick', postcode: '3056' })).resolves.toBeUndefined()
    expect(mocks.xOne).toHaveBeenCalledWith('update_group', expect.objectContaining({
      street_name: 'Brunswick Road', suburb: 'Brunswick', postcode: '3056',
    }))
  })
})
