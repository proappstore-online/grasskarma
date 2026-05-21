import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User as FasUser } from '@proappstore/sdk'
import { useProGate } from '@proappstore/sdk/hooks'
import { app } from '../lib/app'
import { getUser, createUser } from '../lib/users'
import type { User, Role } from '../models'

type Gate = 'loading' | 'signed-out' | 'no-role' | 'ready'

interface AuthState {
  gate: Gate
  fasUser: FasUser | null
  user: User | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  // First-time onboarding — creates the users row with the chosen role.
  chooseRole: (role: Role) => Promise<void>
  // Force refetch of the users row after a profile update.
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const gateState = useProGate(app, { allowFree: true })
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)

  const loadUser = async (fasUser: FasUser) => {
    setLoadingUser(true)
    try {
      const u = await getUser(fasUser.id)
      setUser(u)
    } finally {
      setLoadingUser(false)
    }
  }

  useEffect(() => {
    if (gateState.gate === 'ready' && gateState.user) {
      void loadUser(gateState.user)
    } else {
      setUser(null)
    }
  }, [gateState.gate, gateState.user?.id])

  const chooseRole = async (role: Role) => {
    if (!gateState.user) throw new Error('Not signed in')
    const fasUser = gateState.user
    const created = await createUser({
      id: fasUser.id,
      role,
      name: fasUser.login,
      photoUrl: fasUser.avatarUrl,
    })
    setUser(created)
  }

  const refresh = async () => {
    if (gateState.user) await loadUser(gateState.user)
  }

  const gate: Gate =
    gateState.gate === 'loading' || (gateState.gate === 'ready' && loadingUser)
      ? 'loading'
      : gateState.gate === 'signed-out'
        ? 'signed-out'
        : gateState.gate === 'no-subscription'
          ? 'signed-out' // subscription gate isn't enforced in v1; route to sign-in
          : !user
            ? 'no-role'
            : 'ready'

  const value: AuthState = {
    gate,
    fasUser: gateState.user ?? null,
    user,
    signIn: async () => gateState.signIn(),
    signOut: async () => {
      await app.auth.signOut()
      setUser(null)
    },
    chooseRole,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside AuthProvider')
  return ctx
}
