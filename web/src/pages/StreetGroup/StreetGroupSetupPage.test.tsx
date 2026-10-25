import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createGroup: vi.fn() }))

vi.mock('../../lib/streetGroups', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/streetGroups')>(),
  createGroup: mocks.createGroup,
}))

import { createGroupAndRefresh, ExistingGroupList, groupsIncludingCanonicalConflict } from './StreetGroupSetupPage'
import type { StreetGroup } from '../../models'

const canonicalGroup: StreetGroup = {
  id: 'canonical-group',
  name: 'Maple Street neighbours',
  streetName: 'Maple Street',
  suburb: 'Carlton',
  postcode: '3053',
  state: null,
  country: 'AU',
  centerLat: null,
  centerLng: null,
  adminIds: ['admin'],
  memberIds: ['admin'],
  assignedMowerId: null,
  status: 'forming',
  createdAt: 1,
  updatedAt: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StreetGroupSetupPage create flow', () => {
  it('refreshes after the single atomic create action succeeds', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mocks.createGroup.mockResolvedValue(canonicalGroup)

    await expect(createGroupAndRefresh({
      name: 'Maple Street neighbours',
      streetName: 'Maple Street',
      suburb: 'Carlton',
      postcode: '3053',
      country: 'AU',
    }, refresh)).resolves.toBe(canonicalGroup)

    expect(mocks.createGroup).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(mocks.createGroup.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0])
  })
})

describe('StreetGroupSetupPage duplicate location flow', () => {
  it('replaces a duplicate conflict with the canonical group instead of a dead-end result', () => {
    const stale = { ...canonicalGroup, id: 'stale-result', name: 'Stale result' }

    expect(groupsIncludingCanonicalConflict([stale, canonicalGroup], canonicalGroup))
      .toEqual([canonicalGroup, stale])
  })

  it('offers a Request to join action for the canonical duplicate group', () => {
    const markup = renderToStaticMarkup(
      <ExistingGroupList groups={[canonicalGroup]} busy={false} requestedIds={[]} onJoin={vi.fn()} />,
    )

    expect(markup).toContain('Maple Street neighbours')
    expect(markup).toContain('Request to join')
  })
})
