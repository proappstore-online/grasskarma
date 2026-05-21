import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function MainLayout() {
  const { user, signOut } = useAuth()
  const role = user?.role
  const base = role === 'mower' ? '/mower' : role === 'admin' ? '/admin' : '/app'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-[var(--accent-soft)]'}`

  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] text-[var(--ink)]">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to={base} className="display-font text-xl font-bold">
            GrassKarma
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {role === 'client' && (
              <>
                <NavLink to="/app" end className={linkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/app/setup" className={linkClass}>
                  Street group
                </NavLink>
                <NavLink to="/app/mowers" className={linkClass}>
                  Mowers
                </NavLink>
                <NavLink to="/app/sharehire" className={linkClass}>
                  Share / hire
                </NavLink>
                <NavLink to="/app/membership" className={linkClass}>
                  Membership
                </NavLink>
              </>
            )}
            {role === 'mower' && (
              <>
                <NavLink to="/mower" end className={linkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/mower/streets" className={linkClass}>
                  Streets
                </NavLink>
                <NavLink to="/mower/history" className={linkClass}>
                  History
                </NavLink>
              </>
            )}
            {role === 'admin' && (
              <>
                <NavLink to="/admin" end className={linkClass}>
                  Admin
                </NavLink>
                <NavLink to="/admin/users" className={linkClass}>
                  Users
                </NavLink>
                <NavLink to="/admin/groups" className={linkClass}>
                  Groups
                </NavLink>
              </>
            )}
            <NavLink to={`${base}/account`} className={linkClass}>
              Account
            </NavLink>
            <button
              onClick={() => void signOut()}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
