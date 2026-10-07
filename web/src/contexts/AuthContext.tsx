import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthProvider as SignInProvider, User as FasUser } from '@proappstore/sdk'
import { useProGate } from '@proappstore/sdk/hooks'
import { app } from '../lib/app'
import { getUser, createUser } from '../lib/users'
import { drainPendingPhotoCleanup } from '../lib/photos'
import type { User, Role } from '../models'

export type Gate = 'loading' | 'signed-out' | 'profile-error' | 'no-role' | 'ready'

type PlatformGate = 'loading' | 'signed-out' | 'no-subscription' | 'ready'

interface ProfileLoadRequest {
  requestGeneration: number
  activeGeneration: number
  requestedUserId: string
  activeUserId: string | null
}

// A profile response is valid only for the same authenticated session that
// started it. Both guards are needed: a retry supersedes an earlier request,
// while the user id prevents a response from a previous session being applied.
export function shouldCommitProfileLoad({
  requestGeneration,
  activeGeneration,
  requestedUserId,
  activeUserId,
}: ProfileLoadRequest): boolean {
  return requestGeneration === activeGeneration && requestedUserId === activeUserId
}

export function resolveAuthGate({
  platformGate,
  loadingUser,
  user,
  profileLoadError,
}: {
  platformGate: PlatformGate
  loadingUser: boolean
  user: User | null
  profileLoadError: Error | null
}): Gate {
  if (platformGate === 'loading' || (platformGate === 'ready' && loadingUser)) return 'loading'
  if (platformGate === 'signed-out' || platformGate === 'no-subscription') return 'signed-out'
  if (profileLoadError) return 'profile-error'
  return user ? 'ready' : 'no-role'
}

interface AuthState {
  gate: Gate
  fasUser: FasUser | null
  user: User | null
  profileLoadError: Error | null
  signIn: (provider: SignInProvider) => Promise<void>
  signOut: () => Promise<void>
  // First-time onboarding — creates the users row with the chosen role.
  chooseRole: (role: Role) => Promise<void>
  // Force refetch of the users row after a profile update.
  refresh: () => Promise<void>
  // Retry a failed initial profile lookup without sending the user to onboarding.
  retryProfileLoad: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const gateState = useProGate(app, { allowFree: true })
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState<Error | null>(null)
  const profileLoadGeneration = useRef(0)
  const activeProfileUserId = useRef<string | null>(null)

  // Keep this ref current during render, rather than waiting for the effect
  // below. That closes the small window between an auth-state render and its
  // effect cleanup where an obsolete request might otherwise resolve.
  activeProfileUserId.current = gateState.gate === 'ready' ? gateState.user?.id ?? null : null

  const loadUser = useCallback(async (fasUser: FasUser) => {
    if (activeProfileUserId.current !== fasUser.id) return
    const requestGeneration = ++profileLoadGeneration.current
    setLoadingUser(true)
    setProfileLoadError(null)
    try {
      const u = await getUser(fasUser.id)
      if (shouldCommitProfileLoad({
        requestGeneration,
        activeGeneration: profileLoadGeneration.current,
        requestedUserId: fasUser.id,
        activeUserId: activeProfileUserId.current,
      })) {
        setUser(u)
      }
    } catch (error) {
      if (shouldCommitProfileLoad({
        requestGeneration,
        activeGeneration: profileLoadGeneration.current,
        requestedUserId: fasUser.id,
        activeUserId: activeProfileUserId.current,
      })) {
        setProfileLoadError(error instanceof Error ? error : new Error(String(error)))
      }
    } finally {
      if (shouldCommitProfileLoad({
        requestGeneration,
        activeGeneration: profileLoadGeneration.current,
        requestedUserId: fasUser.id,
        activeUserId: activeProfileUserId.current,
      })) {
        setLoadingUser(false)
      }
    }
  }, [])

  useEffect(() => {
    if (gateState.gate === 'ready' && gateState.user) {
      // This also covers an account that was deleted after its cleanup queue
      // was committed but before the browser could finish deleting R2 files.
      void drainPendingPhotoCleanup()
      void loadUser(gateState.user)
    } else {
      // Invalidate immediately when the authenticated session changes. An
      // in-flight request can still settle, but can no longer update state.
      profileLoadGeneration.current += 1
      setUser(null)
      setProfileLoadError(null)
      setLoadingUser(false)
    }
  }, [gateState.gate, gateState.user?.id, loadUser])

  const chooseRole = async (role: Role) => {
    if (!gateState.user) throw new Error('Not signed in')
    const fasUser = gateState.user
    const created = await createUser({
      id: fasUser.id,
      role,
      name: fasUser.login,
      photoUrl: fasUser.avatarUrl,
    })
    profileLoadGeneration.current += 1
    setProfileLoadError(null)
    setUser(created)
  }

  const refresh = async () => {
    if (gateState.user) await loadUser(gateState.user)
  }

  const retryProfileLoad = async () => {
    if (gateState.gate === 'ready' && gateState.user) await loadUser(gateState.user)
  }

  const gate = resolveAuthGate({
    platformGate: gateState.gate,
    loadingUser,
    user,
    profileLoadError,
  })

  const value: AuthState = {
    gate,
    fasUser: gateState.user ?? null,
    user,
    profileLoadError,
    // useProGate's signIn is GitHub-only; call the SDK directly to pick the provider.
    signIn: async (provider) => app.auth.signIn(provider),
    signOut: async () => {
      // Do this before awaiting the SDK so a late profile response cannot
      // resurrect the just-signed-out user while sign-out is in progress.
      activeProfileUserId.current = null
      profileLoadGeneration.current += 1
      await app.auth.signOut()
      setUser(null)
      setProfileLoadError(null)
      setLoadingUser(false)
    },
    chooseRole,
    refresh,
    retryProfileLoad,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth used outside AuthProvider')
  return ctx
}
