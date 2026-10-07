import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MainLayout, MOBILE_NAVIGATION_BREAKPOINT, isMobileNavigationViewport } from './MainLayout'

const signOut = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'client' }, signOut }),
}))

function renderAtViewport(width: number) {
  vi.stubGlobal('window', {
    innerWidth: width,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/app']}>
      <MainLayout />
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('MainLayout mobile navigation', () => {
  it('collapses client links behind the hamburger menu below the mobile breakpoint', () => {
    const markup = renderAtViewport(375)

    expect(isMobileNavigationViewport(MOBILE_NAVIGATION_BREAKPOINT - 1)).toBe(true)
    expect(markup).toContain('aria-label="Open navigation menu"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('>Dashboard<')
    expect(markup).not.toContain('>Sign out<')
  })

  it('keeps the full navigation visible from the desktop breakpoint upward', () => {
    const markup = renderAtViewport(MOBILE_NAVIGATION_BREAKPOINT)

    expect(isMobileNavigationViewport(MOBILE_NAVIGATION_BREAKPOINT)).toBe(false)
    expect(markup).not.toContain('Open navigation menu')
    expect(markup).toContain('>Dashboard<')
    expect(markup).toContain('>Sign out<')
  })
})
