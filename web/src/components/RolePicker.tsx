import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../models'

export function RolePicker() {
  const { fasUser, chooseRole } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (role: Role) => {
    setBusy(true)
    setError(null)
    try {
      await chooseRole(role)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center gap-6 px-4 py-12">
      <h1 className="display-font text-3xl font-bold text-[var(--ink)]">
        Welcome, {fasUser?.login ?? 'neighbour'}
      </h1>
      <p className="text-center text-[var(--muted)]">
        Are you here to hire a mower for your street, or to mow streets?
      </p>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <button
          disabled={busy}
          onClick={() => pick('client')}
          className="rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-6 text-left hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
        >
          <div className="display-font text-xl font-semibold">I'm a homeowner</div>
          <div className="mt-2 text-sm opacity-80">
            Join or create a street group, find a mower, get the lawn done.
          </div>
        </button>
        <button
          disabled={busy}
          onClick={() => pick('mower')}
          className="rounded-2xl border border-[var(--line)] bg-[var(--secondary-soft)] p-6 text-left hover:bg-[var(--secondary)] hover:text-white disabled:opacity-50"
        >
          <div className="display-font text-xl font-semibold">I mow lawns</div>
          <div className="mt-2 text-sm opacity-80">
            Browse open streets, get voted in by neighbours, run a route.
          </div>
        </button>
      </div>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  )
}
