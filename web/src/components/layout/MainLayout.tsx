import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// Keep this aligned with Tailwind's `md` breakpoint. At this width the header
// switches from its horizontal navigation to the menu toggle.
export const MOBILE_NAVIGATION_BREAKPOINT = 768

export function isMobileNavigationViewport(viewportWidth: number) {
  return viewportWidth < MOBILE_NAVIGATION_BREAKPOINT
}

function getViewportWidth() {
  return typeof window === 'undefined' ? MOBILE_NAVIGATION_BREAKPOINT : window.innerWidth
}

function useMobileNavigation() {
  const [isMobile, setIsMobile] = useState(() => isMobileNavigationViewport(getViewportWidth()))

  useEffect(() => {
    const updateViewport = () => setIsMobile(isMobileNavigationViewport(getViewportWidth()))
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  return isMobile
}

export function MainLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const role = user?.role
  const base = role === 'mower' ? '/mower' : role === 'admin' ? '/admin' : '/app'
  const isMobile = useMobileNavigation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname, isMobile])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-[var(--accent-soft)]'}`

  const navigation = (
    <>
      {role === 'client' && (
        <>
          <NavLink to="/app" end className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/app/setup" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Street group
          </NavLink>
          <NavLink to="/app/mowers" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Mowers
          </NavLink>
          <NavLink to="/app/sharehire" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Share / hire
          </NavLink>
          <NavLink to="/app/membership" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Membership
          </NavLink>
        </>
      )}
      {role === 'mower' && (
        <>
          <NavLink to="/mower" end className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/mower/streets" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Streets
          </NavLink>
          <NavLink to="/mower/history" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            History
          </NavLink>
        </>
      )}
      {role === 'admin' && (
        <>
          <NavLink to="/admin" end className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Admin
          </NavLink>
          <NavLink to="/admin/users" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Users
          </NavLink>
          <NavLink to="/admin/groups" className={linkClass} onClick={() => setIsMenuOpen(false)}>
            Groups
          </NavLink>
        </>
      )}
      <NavLink to={`${base}/account`} className={linkClass} onClick={() => setIsMenuOpen(false)}>
        Account
      </NavLink>
      <button
        onClick={() => {
          setIsMenuOpen(false)
          void signOut()
        }}
        className="rounded-md px-3 py-1.5 text-left text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
      >
        Sign out
      </button>
    </>
  )

  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to={base} className="display-font text-xl font-bold">
            GrassKarma
          </Link>
          {isMobile ? (
            <button
              type="button"
              aria-controls="main-navigation"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-md p-2 text-[var(--ink)] hover:bg-[var(--accent-soft)]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          ) : (
            <nav aria-label="Main navigation" className="flex items-center gap-1">
              {navigation}
            </nav>
          )}
        </div>
        {isMobile && isMenuOpen && (
          <nav id="main-navigation" aria-label="Main navigation" className="border-t border-[var(--line)]">
            <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-1 px-4 py-3">
              {navigation}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
