import { describe, expect, it } from 'vitest'
import { platformNavigationDenylist } from './pwa'

const isHandledByAppShell = (pathname: string) =>
  !platformNavigationDenylist.some((pattern) => pattern.test(pathname))

describe('PWA OAuth navigation', () => {
  it('leaves PAS OAuth start and callback navigations to the platform after sign-out', () => {
    // Sign-out clears the cookie. A subsequent Google sign-in must navigate to
    // the platform's start endpoint and return through its callback so it can
    // issue a fresh HttpOnly session. If either navigation receives index.html
    // from the service worker, the user remains signed out.
    expect(isHandledByAppShell('/.pas/auth/start')).toBe(false)
    expect(isHandledByAppShell('/.pas/auth/callback')).toBe(false)
  })

  it('continues to use the app shell for normal client-side routes', () => {
    expect(isHandledByAppShell('/account')).toBe(true)
  })
})
