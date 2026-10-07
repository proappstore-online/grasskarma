import { app } from './app'

/**
 * The platform session, rather than a browser-supplied identifier, defines
 * the owner of every caller-scoped action.
 */
export function requireAuthenticatedCaller(): string {
  const userId = app.auth.user?.id
  if (!userId) throw new Error('Not signed in')
  return userId
}
