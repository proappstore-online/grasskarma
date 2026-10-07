import { q } from './actions'
import { ensureMigrated } from './db'

type PublicMowerContactRow = { public_contact_email: string }

/**
 * Validate the opt-in address before it reaches the registered action. The
 * database repeats the structural constraint because callers can bypass UI.
 */
export function normalizePublicContactEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? ''
  if (!email) return null
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid public contact email address.')
  }
  return email
}

/** Resolve a mower's deliberately published contact address for a hire enquiry. */
export async function getPublicMowerContact(mowerId: string): Promise<string | null> {
  await ensureMigrated()
  const rows = await q<PublicMowerContactRow>('get_public_mower_contact', { mower_id: mowerId })
  return rows[0]?.public_contact_email ?? null
}

export function mowerContactHref(email: string): string {
  return `mailto:${email}`
}
