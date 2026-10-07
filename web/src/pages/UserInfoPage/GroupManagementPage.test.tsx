import { describe, expect, it } from 'vitest'
import {
  resolveGroupManagementView,
  shouldCommitGroupManagementLoad,
} from './GroupManagementPage'
import type { StreetGroup } from '../../models'

const group: StreetGroup = {
  id: 'group-1',
  name: 'Maple Street neighbours',
  streetName: 'Maple Street',
  suburb: 'Carlton',
  postcode: '3053',
  state: 'VIC',
  country: 'AU',
  centerLat: null,
  centerLng: null,
  adminIds: ['client-1'],
  memberIds: ['client-1'],
  assignedMowerId: null,
  status: 'forming',
  createdAt: 1,
  updatedAt: 1,
}

describe('GroupManagementPage route state', () => {
  it('sends a client who navigates directly without a group to setup after loading finishes', () => {
    expect(resolveGroupManagementView({
      hasProfile: true,
      loading: false,
      streetGroupId: null,
      group: null,
      userId: 'client-1',
    })).toBe('setup')
  })

  it('keeps the loader visible while the client profile is still arriving', () => {
    expect(resolveGroupManagementView({
      hasProfile: false,
      loading: true,
      streetGroupId: undefined,
      group: null,
      userId: undefined,
    })).toBe('loading')
  })

  it('renders management content after a group and its client admin have loaded', () => {
    expect(resolveGroupManagementView({
      hasProfile: true,
      loading: false,
      streetGroupId: group.id,
      group,
      userId: 'client-1',
    })).toBe('content')
  })

  it('does not commit an obsolete or unmounted group request', () => {
    expect(shouldCommitGroupManagementLoad({
      requestGeneration: 3,
      activeGeneration: 4,
      mounted: true,
    })).toBe(false)
    expect(shouldCommitGroupManagementLoad({
      requestGeneration: 4,
      activeGeneration: 4,
      mounted: false,
    })).toBe(false)
    expect(shouldCommitGroupManagementLoad({
      requestGeneration: 4,
      activeGeneration: 4,
      mounted: true,
    })).toBe(true)
  })
})
