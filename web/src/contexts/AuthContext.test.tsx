import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { app } from '../lib/app'
import { AuthProvider, useAuth } from './AuthContext'

// #1: useProGate's signIn ignores the provider, so the context must forward it
// to the SDK itself or Google silently becomes GitHub.
describe('AuthContext signIn', () => {
  it.each(['google', 'github'] as const)('forwards %s to app.auth.signIn', async (provider) => {
    const spy = vi.spyOn(app.auth, 'signIn').mockImplementation(() => {})
    let ctx: ReturnType<typeof useAuth> | undefined
    function Capture() {
      ctx = useAuth()
      return null
    }
    renderToString(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    )

    await ctx!.signIn(provider)

    expect(spy).toHaveBeenCalledWith(provider)
    spy.mockRestore()
  })
})
