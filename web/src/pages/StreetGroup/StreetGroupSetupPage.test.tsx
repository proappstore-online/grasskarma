import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ExistingGroupList, groupsIncludingCanonicalConflict } from './StreetGroupSetupPage'
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
