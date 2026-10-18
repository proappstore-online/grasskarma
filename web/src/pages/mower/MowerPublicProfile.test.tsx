import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AsyncResource } from '../../hooks/useAsyncResource'
import type { User } from '../../models'

const resource = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../../hooks/useAsyncResource', () => ({ useAsyncResource: () => resource.current }))

const { default: MowerPublicProfile } = await import('./MowerPublicProfile')

const user = (role: User['role']): User => ({
  id: 'user-1',
  publicContactEmail: null,
  email: null,
  name: 'Sam',
  photoUrl: null,
  role,
  suburb: 'Carlton',
  postcode: '3053',
  state: null,
  country: null,
  lat: null,
  lng: null,
  clientProfile: null,
  mowerProfile: role === 'mower' ? { serviceRadiusKm: 5 } : null,
  streetGroupId: null,
  createdAt: 1,
  updatedAt: 1,
})

function render(state: Partial<AsyncResource<unknown>>) {
  resource.current = { data: null, error: null, loading: false, ...state }
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/mower/user-1']}>
      <Routes><Route path="/mower/:mowerId" element={<MowerPublicProfile />} /></Routes>
    </MemoryRouter>,
  )
}

describe('MowerPublicProfile load states', () => {
  beforeEach(() => { resource.current = null })

  it('reports a failed load as an error rather than "Mower not found"', () => {
    const markup = render({ error: new Error('network') })
    expect(markup).toContain('Failed to load mower profile.')
    expect(markup).not.toContain('Mower not found.')
  })

  it('does not present a non-mower row as a mower profile', () => {
    const data = { reviews: [], rating: { average: 0, count: 0 } }
    expect(render({ data: { ...data, mower: user('client') } })).toContain('Mower not found.')
    expect(render({ data: { ...data, mower: user('mower') } })).toContain('Sam')
  })
})
