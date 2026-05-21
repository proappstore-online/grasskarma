import { initPro } from '@proappstore/sdk'
import { useProGate } from '@proappstore/sdk/hooks'

const app = initPro({ appId: 'grasskarma' })

export default function App() {
  const { gate, user, signIn } = useProGate(app, { allowFree: true })

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
        <h1 className="display-font text-3xl font-bold text-[var(--ink)]">Grasskarma</h1>
        <p className="text-[var(--muted)]">Sign in to get started.</p>
        <button onClick={signIn} className="rounded-2xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white">Sign in with GitHub</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="display-font text-2xl font-bold text-[var(--ink)]">Grasskarma</h1>
      <p className="mt-2 text-[var(--muted)]">Welcome, {user?.login}! Edit web/src/App.tsx to start building.</p>
    </div>
  )
}