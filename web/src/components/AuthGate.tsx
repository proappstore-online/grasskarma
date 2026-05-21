import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { RolePicker } from './RolePicker'

export function AuthGate({ children }: { children: ReactNode }) {
  const { gate, signIn } = useAuth()

  if (gate === 'loading') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    )
  }

  if (gate === 'signed-out') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4">
        <h1 className="display-font text-3xl font-bold text-[var(--ink)]">GrassKarma</h1>
        <p className="text-[var(--muted)]">Hyper-local lawn care, one street at a time.</p>
        <button
          onClick={() => void signIn()}
          className="rounded-2xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent)] hover:opacity-90"
        >
          Sign in with GitHub
        </button>
      </div>
    )
  }

  if (gate === 'no-role') {
    return <RolePicker />
  }

  return <>{children}</>
}
