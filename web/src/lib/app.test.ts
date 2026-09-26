import { afterEach, describe, expect, it, vi } from 'vitest'
import { app } from './app'

afterEach(() => vi.unstubAllGlobals())

// #1: a cross-origin dataApiBase carried no session under platform-cookie auth,
// 401'd, and the SDK signed the user straight back out after OAuth.
describe('app SDK instance', () => {
  it('uses platform-cookie auth', () => {
    expect(app.auth.usesPlatformCookie).toBe(true)
  })

  it('sends data calls to the same-origin /.pas/data path with the session cookie', async () => {
    const fetchMock = vi.fn(async () => Response.json({ applied: [] }))
    vi.stubGlobal('fetch', fetchMock)
    // Private in the SDK types; set it so authenticatedFetch treats us as signed in.
    ;(app.auth as unknown as { session: unknown }).session = { token: null, user: { id: 'u1' } }

    await app.db.migrate([])

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/.pas/data/migrate')
    expect(init.credentials).toBe('same-origin')
  })
})
