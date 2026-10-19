import type { APIRequestContext, BrowserContext } from '@playwright/test'

// ─── SMOKE TEST ACCOUNT ──────────────────────────────────────────────────────
// The signed-in flows run as ONE dedicated platform account that exists only
// for these tests. Its session is never a stored password: CI mints it from
// the workflow's GitHub OIDC token (POST /v1/auth/exchange/oidc, granted by a
// platform admin) and passes it in E2E_SESSION_TOKEN. Locally, export a
// session for the same dedicated account. Never point this at a real person.
export const SESSION_TOKEN = process.env.E2E_SESSION_TOKEN || ''
export const hasSession = SESSION_TOKEN.length > 0

export const API = process.env.E2E_API_BASE || 'https://api.proappstore.online'
export const BASE_URL = process.env.E2E_BASE_URL || 'https://grasskarma.proappstore.online'
export const APP_ID = new URL(BASE_URL).hostname.split('.')[0]!

// Every row the suite writes carries one of these markers, so smoke data is
// recognisable in the live database and the cleanup never touches anything
// else.
export const SMOKE_ACCOUNT_NAME = 'SMOKE TEST ACCOUNT (automated, deleted after each run)'
export const SMOKE_STREET_PREFIX = 'SMOKE TEST'
export const SMOKE_SUBURB = 'Smoketest'
export const SMOKE_POSTCODE = '0000'

const SESSION_COOKIE = '__Host-pas_session'

/**
 * Sign the browser in the way the OAuth callback does: the host sets this
 * HttpOnly cookie after a successful Google/GitHub sign-in, and the app reads
 * the session from it through /.pas/auth/me.
 */
export async function signInBrowser(context: BrowserContext): Promise<void> {
  await context.addCookies([{
    name: SESSION_COOKIE,
    value: encodeURIComponent(SESSION_TOKEN),
    url: BASE_URL,
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

type ActionResult<T> = { rows?: T[]; meta?: { changes: number } }

/** Call a registered app action as the smoke account. */
export async function action<T = unknown>(request: APIRequestContext, name: string, params: Record<string, unknown> = {}): Promise<ActionResult<T>> {
  const response = await request.post(`${API}/v1/apps/${APP_ID}/actions/${name}`, {
    headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
    data: { params },
  })
  if (!response.ok()) throw new Error(`${name} failed: HTTP ${response.status()} ${await response.text()}`)
  return response.json() as Promise<ActionResult<T>>
}

export async function smokeAccountId(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${API}/v1/auth/me`, { headers: { Authorization: `Bearer ${SESSION_TOKEN}` } })
  if (!response.ok()) throw new Error(`The smoke session was rejected by /v1/auth/me (HTTP ${response.status()}). Mint a fresh one.`)
  return ((await response.json()) as { id: string }).id
}

type UserRow = { id: string; name: string | null; role: string; street_group_id: string | null }
type GroupRow = { id: string; street_name: string | null; admin_ids: string }

/**
 * Remove everything the smoke account owns in GrassKarma: its SMOKE TEST
 * group (with that group's schedules and requests) and then its profile row.
 * Runs before the flows, to clear a previous failed run, and after them.
 *
 * Refuses, rather than deletes, if the account looks like a real user's: a
 * profile without the smoke marker name, or membership of a non-smoke group.
 */
export async function cleanUpSmokeAccount(request: APIRequestContext): Promise<void> {
  const userId = await smokeAccountId(request)
  const me = (await action<UserRow>(request, 'get_user', { id: userId })).rows?.[0]
  if (!me) return
  if (me.name !== SMOKE_ACCOUNT_NAME || me.role === 'admin') {
    throw new Error(
      `Refusing to clean up ${userId}: its GrassKarma profile is not marked "${SMOKE_ACCOUNT_NAME}". ` +
      'The smoke session must belong to a dedicated smoke-test account. If it does, a previous run stopped ' +
      'between onboarding and marking the profile; delete that profile by hand and re-run.',
    )
  }
  if (me.street_group_id) {
    const group = (await action<GroupRow>(request, 'get_group', { id: me.street_group_id })).rows?.[0]
    if (group) {
      if (!group.street_name?.startsWith(SMOKE_STREET_PREFIX)) {
        throw new Error(`Refusing to clean up: the smoke account belongs to a non-smoke group (${group.id}).`)
      }
      if ((JSON.parse(group.admin_ids) as string[]).includes(userId)) {
        await action(request, 'delete_group', { group_id: group.id })
      }
    }
  }
  await action(request, 'admin_delete_user', { user_id: userId, photo_keys: '[]' })
}
