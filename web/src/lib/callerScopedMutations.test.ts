import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createUser, updateUser, type UserCreate, type UserPatch } from './users'
import { createGroup, createGroupInterest, type GroupCreate } from './streetGroups'
import { castVote, createMowerInterest } from './mowerInterests'
import { createReview, type ReviewCreate } from './reviews'
import { recordHistory, type HistoryCreate } from './history'

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  q: vi.fn(),
  xOne: vi.fn(),
  xBatch: vi.fn(),
  user: { id: 'verified-caller' } as { id: string } | null,
}))

vi.mock('./app', () => ({ app: { db: { migrate: mocks.migrate }, auth: { get user() { return mocks.user } } } }))
vi.mock('./actions', () => ({
  q: mocks.q,
  xOne: mocks.xOne,
  xBatch: mocks.xBatch,
  ActionRefusedError: class ActionRefusedError extends Error {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: 'verified-caller' }
  mocks.migrate.mockResolvedValue(undefined)
  mocks.q.mockResolvedValue([])
  mocks.xOne.mockResolvedValue({ changes: 1 })
  mocks.xBatch.mockResolvedValue({ changes: 1 })
})

describe('caller-scoped mutation contracts', () => {
  it('uses the authenticated caller for returned ownership and never sends a caller id to the action', async () => {
    const interest = await createGroupInterest('group', 'hello')
    const mowerInterest = await createMowerInterest('group')
    const review = await createReview({ mowerId: 'mower', rating: 5 })
    const history = await recordHistory({ streetName: 'Maple Street' })

    expect(interest.userId).toBe('verified-caller')
    expect(mowerInterest.mowerId).toBe('verified-caller')
    expect(review.reviewerId).toBe('verified-caller')
    expect(history.mowerId).toBe('verified-caller')
    expect(mocks.xOne).toHaveBeenCalledWith('create_group_interest', expect.not.objectContaining({ user_id: expect.anything() }))
    expect(mocks.xOne).toHaveBeenCalledWith('create_mower_interest', expect.not.objectContaining({ mower_id: expect.anything() }))
    expect(mocks.xOne).toHaveBeenCalledWith('create_review', expect.not.objectContaining({ reviewer_id: expect.anything() }))
    expect(mocks.xOne).toHaveBeenCalledWith('record_history', expect.not.objectContaining({ mower_id: expect.anything() }))
  })

  it('uses one authenticated caller lookup for the post-create user read', async () => {
    mocks.q.mockResolvedValueOnce([{
      id: 'verified-caller', public_contact_email: null, email: null, name: 'Caller', photo_url: null,
      role: 'client', suburb: null, postcode: null, state: null, country: null, lat: null, lng: null,
      client_profile: null, mower_profile: null, street_group_id: null, created_at: 1, updated_at: 1,
    }])

    await expect(createUser({ role: 'client', name: 'Caller' })).resolves.toMatchObject({ id: 'verified-caller' })
    expect(mocks.q).toHaveBeenCalledWith('get_user', { id: 'verified-caller' })
    await updateUser({ name: 'Updated caller' })
    await castVote('interest', 1)
    expect(mocks.xOne).toHaveBeenCalledWith('update_me', expect.objectContaining({ name: 'Updated caller' }))
    expect(mocks.xOne).toHaveBeenCalledWith('cast_vote', { interest_id: 'interest', vote: 1 })
  })

  it('rejects caller-scoped writes before they can run without an authenticated caller', async () => {
    mocks.user = null
    await expect(createGroupInterest('group')).rejects.toThrow('Not signed in')
    expect(mocks.xOne).not.toHaveBeenCalled()
  })
})

describe('caller-scoped API types', () => {
  it('does not expose a caller-selected identity parameter', () => {
    expectTypeOf<UserCreate>().not.toMatchTypeOf<{ id: string }>()
    expectTypeOf<GroupCreate>().not.toMatchTypeOf<{ createdBy: string }>()
    expectTypeOf<ReviewCreate>().not.toMatchTypeOf<{ reviewerId: string }>()
    expectTypeOf<HistoryCreate>().not.toMatchTypeOf<{ mowerId: string }>()
    expectTypeOf(createUser).parameters.toEqualTypeOf<[UserCreate]>()
    expectTypeOf(updateUser).parameters.toEqualTypeOf<[UserPatch]>()
    expectTypeOf(createGroupInterest).parameters.toEqualTypeOf<[string, (string | null | undefined)?]>()
    expectTypeOf(createMowerInterest).parameters.toEqualTypeOf<[string, (string | null | undefined)?]>()
    expectTypeOf(castVote).parameters.toEqualTypeOf<[string, -1 | 1]>()
    expectTypeOf(createGroup).parameters.toEqualTypeOf<[GroupCreate]>()
  })
})
