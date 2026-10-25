import type { BrowserContext } from '@playwright/test'
import manifest from '../../mcp.json' with { type: 'json' }

// ─── Hermetic platform stand-in for the a11y suite (#30) ─────────────────────
// The app talks to the platform through exactly two same-origin paths:
//   GET  /.pas/auth/me                                     → the signed-in user
//   POST /.pas/api/v1/apps/grasskarma/actions/<name>       → a registered action
// This file answers both from in-memory fixture rows shaped like the D1 tables
// (web/src/lib/db.ts), so every page renders real content without a session or
// network. Anything else under /.pas/ — or an action this file does not know —
// is recorded in `unhandled` and fails the test, so the fixtures cannot drift
// silently away from the app.

export type Persona = 'signed-out' | 'client' | 'joiner' | 'mower' | 'admin' | 'newcomer'

const T = Date.UTC(2026, 9, 1)
const DAY = 86_400_000

const user = (row: Partial<UserRow> & Pick<UserRow, 'id' | 'name' | 'role'>): UserRow => ({
  email: `${row.id}@example.test`,
  public_contact_email: null,
  photo_url: null,
  suburb: 'Fitzroy',
  postcode: '3065',
  state: 'VIC',
  country: 'AU',
  lat: null,
  lng: null,
  client_profile: null,
  mower_profile: null,
  street_group_id: null,
  created_at: T - 30 * DAY,
  updated_at: T,
  ...row,
})

type UserRow = {
  id: string; email: string | null; public_contact_email: string | null; name: string | null
  photo_url: string | null; role: string | null; suburb: string | null; postcode: string | null
  state: string | null; country: string | null; lat: number | null; lng: number | null
  client_profile: string | null; mower_profile: string | null; street_group_id: string | null
  created_at: number; updated_at: number
}

function fixtures() {
  const users: UserRow[] = [
    user({
      id: 'u-client', name: 'Alex Homeowner', role: 'client', street_group_id: 'g-1', photo_url: '/icon-192.png',
      client_profile: JSON.stringify({ street: 'Brunswick St', addressNumber: '12', lawnAreaM2: 80, bio: 'Front and back lawn.' }),
    }),
    user({ id: 'u-neighbour', name: 'Sam Neighbour', role: 'client', street_group_id: 'g-1' }),
    // A long unbroken email exercises the 360px overflow check.
    user({ id: 'u-applicant', name: 'Jordan Applicant', role: 'client', email: 'jordan.applicant.with.a.very.long.address@example.test' }),
    user({ id: 'u-newcomer', name: 'Casey Newcomer', role: 'client' }),
    // A homeowner with a profile but no street group yet: /app/setup shows the
    // search-and-join form instead of redirecting to the dashboard.
    user({ id: 'u-joiner', name: 'Drew Joiner', role: 'client' }),
    user({
      id: 'u-mower', name: 'Morgan Mower', role: 'mower', photo_url: '/icon-192.png', public_contact_email: 'morgan@example.test',
      mower_profile: JSON.stringify({ suburb: 'Fitzroy', postcode: '3065', serviceRadiusKm: 5, ratePerM2: 0.5, bio: 'Reliable, quiet electric mower.' }),
    }),
    user({
      id: 'u-mower-2', name: 'Riley Cutter', role: 'mower',
      mower_profile: JSON.stringify({ suburb: 'Collingwood', postcode: '3066', serviceRadiusKm: 8 }),
    }),
    user({ id: 'u-admin', name: 'Pat Admin', role: 'admin' }),
  ]
  const groups = [
    {
      id: 'g-1', name: 'Brunswick St Fitzroy', street_name: 'Brunswick St', suburb: 'Fitzroy', postcode: '3065', state: 'VIC', country: 'AU',
      center_lat: null, center_lng: null, admin_ids: JSON.stringify(['u-client']), member_ids: JSON.stringify(['u-client', 'u-neighbour']),
      assigned_mower_id: 'u-mower', status: 'active', created_at: T - 20 * DAY, updated_at: T,
    },
    {
      id: 'g-2', name: 'Gore St Fitzroy', street_name: 'Gore St', suburb: 'Fitzroy', postcode: '3065', state: 'VIC', country: 'AU',
      center_lat: null, center_lng: null, admin_ids: JSON.stringify(['u-neighbour']), member_ids: JSON.stringify(['u-neighbour']),
      assigned_mower_id: null, status: 'forming', created_at: T - 10 * DAY, updated_at: T,
    },
  ]
  const schedules = [
    { id: 's-1', group_id: 'g-1', day_of_week: 6, start_time: '09:00', mower_id: 'u-mower', status: 'planned', due_date: T + 3 * DAY, completed_at: null, created_at: T, updated_at: T },
    { id: 's-2', group_id: 'g-1', day_of_week: 6, start_time: '09:00', mower_id: 'u-mower', status: 'done', due_date: T - 4 * DAY, completed_at: T - 4 * DAY, created_at: T - 11 * DAY, updated_at: T - 4 * DAY },
    // Due tomorrow in real time, so the dashboards render the reminder banner (#29).
    { id: 's-4', group_id: 'g-1', day_of_week: null, start_time: '07:30', mower_id: 'u-mower', status: 'planned', due_date: Date.now() + DAY, completed_at: null, created_at: T, updated_at: T },
    // Done and already confirmed by the client persona (#29).
    { id: 's-5', group_id: 'g-1', day_of_week: null, start_time: '08:00', mower_id: 'u-mower', status: 'done', due_date: T - 18 * DAY, completed_at: T - 18 * DAY, created_at: T - 25 * DAY, updated_at: T - 18 * DAY },
    { id: 's-3', group_id: 'g-1', day_of_week: null, start_time: null, mower_id: null, status: 'skipped', due_date: T - 11 * DAY, completed_at: null, created_at: T - 18 * DAY, updated_at: T - 11 * DAY },
  ]
  const groupInterests = [{ id: 'gi-1', group_id: 'g-1', user_id: 'u-applicant', message: 'I live at number 40.', created_at: T - DAY }]
  const mowerInterests = [
    { id: 'mi-1', group_id: 'g-1', mower_id: 'u-mower', message: 'Happy to take this street.', created_at: T - 15 * DAY, updated_at: T - 15 * DAY },
    { id: 'mi-2', group_id: 'g-1', mower_id: 'u-mower-2', message: null, created_at: T - 2 * DAY, updated_at: T - 2 * DAY },
    { id: 'mi-3', group_id: 'g-2', mower_id: 'u-mower', message: null, created_at: T - DAY, updated_at: T - DAY },
  ]
  const votes = [{ interest_id: 'mi-1', voter_id: 'u-client', vote: 1, created_at: T - 14 * DAY }]
  const reviews = [{ id: 'r-1', mower_id: 'u-mower', reviewer_id: 'u-client', group_id: 'g-1', schedule_id: 's-2', rating: 5, comment: 'Tidy edges.', created_at: T - 3 * DAY, updated_at: T - 3 * DAY }]
  // s-2 has an after-photo and awaits the client's confirmation; s-5 is confirmed.
  const completions = [
    { schedule_id: 's-2', after_photo_key: 'u/u-mower/lawns/after-1.jpg' },
    { schedule_id: 's-5', after_photo_key: null },
  ]
  const mowRatings = [{ schedule_id: 's-5', user_id: 'u-client', rating: 4, comment: 'Neat edges.', confirmed_at: T - 17 * DAY }]
  const history = [{ id: 'h-1', mower_id: 'u-mower', group_id: 'g-1', schedule_id: 's-2', street_name: 'Brunswick St', area_sqm: 160, duration_min: 45, income: 80, date: T - 4 * DAY }]
  return { users, groups, schedules, groupInterests, mowerInterests, votes, reviews, history, completions, mowRatings }
}

const PERSONA_USER: Record<Exclude<Persona, 'signed-out'>, string> = {
  client: 'u-client',
  joiner: 'u-joiner',
  mower: 'u-mower',
  admin: 'u-admin',
  newcomer: 'u-newcomer',
}

type Params = Record<string, unknown>
type Db = ReturnType<typeof fixtures>

/** The columns list_schedules joins in: after-photo, the viewer's own rating, the confirmation count. */
function withCompletion<T extends { id: string }>(db: Db, me: string, rows: T[]) {
  return rows.map((row) => {
    const mine = db.mowRatings.find((r) => r.schedule_id === row.id && r.user_id === me)
    return {
      ...row,
      after_photo_key: db.completions.find((c) => c.schedule_id === row.id)?.after_photo_key ?? null,
      my_rating: mine?.rating ?? null,
      my_comment: mine?.comment ?? null,
      confirmation_count: db.mowRatings.filter((r) => r.schedule_id === row.id).length,
    }
  })
}

function query(db: Db, me: string, name: string, p: Params): unknown[] | undefined {
  const eq = <T extends Record<string, unknown>>(rows: T[], key: keyof T, value: unknown) => value == null ? rows : rows.filter((r) => r[key] === value)
  switch (name) {
    case 'get_user': return db.users.filter((u) => u.id === p.id)
    case 'list_users': return eq(eq(eq(db.users, 'role', p.role), 'suburb', p.suburb), 'postcode', p.postcode)
    case 'get_public_mower_contact': return db.users.filter((u) => u.id === p.mower_id).map((u) => ({ public_contact_email: u.public_contact_email }))
    case 'list_photo_cleanup_jobs': return []
    case 'list_groups': return eq(eq(eq(eq(db.groups, 'status', p.status), 'suburb', p.suburb), 'postcode', p.postcode), 'assigned_mower_id', p.mower_id)
    case 'get_group': return db.groups.filter((g) => g.id === p.id)
    case 'list_groups_for_mower': return db.groups.filter((g) => g.assigned_mower_id === me)
    case 'list_groups_by_location': {
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
      return db.groups.filter((g) => norm(g.suburb) === norm(p.suburb) && norm(g.postcode) === norm(p.postcode))
    }
    case 'list_group_members': {
      const group = db.groups.find((g) => g.id === p.group_id)
      const ids: string[] = group ? JSON.parse(group.member_ids) : []
      return ids.map((id) => db.users.find((u) => u.id === id)).filter(Boolean)
    }
    case 'find_group_by_location': return db.groups.filter((g) => g.street_name === p.street_name && g.suburb === p.suburb && g.postcode === p.postcode)
    case 'list_group_interests': return eq(db.groupInterests, 'group_id', p.group_id)
    case 'list_schedules': return withCompletion(db, me, eq(db.schedules, 'group_id', p.group_id))
    case 'list_schedules_for_mower': return withCompletion(db, me, eq(db.schedules, 'mower_id', me))
    case 'list_mow_ratings': return eq(db.mowRatings, 'schedule_id', p.schedule_id)
    case 'list_reviews': return eq(db.reviews, 'mower_id', p.mower_id)
    case 'average_rating': {
      const rows = eq(db.reviews, 'mower_id', p.mower_id)
      return [{ avg: rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null, n: rows.length }]
    }
    case 'list_history': return eq(db.history, 'mower_id', p.mower_id)
    case 'list_interests_for_group': return eq(db.mowerInterests, 'group_id', p.group_id)
    case 'list_interests_for_mower': return eq(db.mowerInterests, 'mower_id', me)
    case 'list_votes': return eq(db.votes, 'interest_id', p.interest_id)
    case 'get_reminder_opt_out': return []
    case 'vote_tally': {
      const rows = eq(db.votes, 'interest_id', p.interest_id)
      return [{ up: rows.filter((v) => v.vote === 1).length, down: rows.filter((v) => v.vote === -1).length }]
    }
  }
  return undefined
}

type ManifestTool = {
  name: string
  operation: 'query' | 'execute' | 'batch'
  statements?: unknown[]
}

// Derive mutation names and response envelopes from the shipped manifest so
// this stand-in cannot silently retain an obsolete platform protocol shape.
const TOOLS = new Map((manifest.tools as ManifestTool[]).map((tool) => [tool.name, tool]))

function mutationResult(action: string) {
  const tool = TOOLS.get(action)
  if (!tool || tool.operation === 'query') return undefined

  const meta = { changes: 1 }
  if (tool.operation === 'execute') return { meta }
  return { results: (tool.statements ?? []).map(() => ({ meta })) }
}

export interface Platform {
  /** Mutating actions the page called, in order. */
  mutations: { name: string; params: Params }[]
  /** Requests this stand-in could not answer; a test fails if any appear. */
  unhandled: string[]
  /** Every action the page called, in order: the page's server round trips (#31). */
  calls: string[]
}

export interface MockOptions {
  /** Extra homeowners added to the client persona's group, to prove a page's call count does not grow with it. */
  extraMembers?: number
}

export async function mockPlatform(context: BrowserContext, persona: Persona, { extraMembers = 0 }: MockOptions = {}): Promise<Platform> {
  const db = fixtures()
  const g1 = db.groups.find((g) => g.id === 'g-1')!
  for (let i = 0; i < extraMembers; i++) {
    db.users.push(user({ id: `u-extra-${i}`, name: `Extra Neighbour ${i}`, role: 'client', street_group_id: 'g-1' }))
    g1.member_ids = JSON.stringify([...JSON.parse(g1.member_ids), `u-extra-${i}`])
  }
  const me = persona === 'signed-out' ? null : PERSONA_USER[persona]
  const platform: Platform = { mutations: [], unhandled: [], calls: [] }

  // Third-party requests (fonts, analytics) are not under test and must not
  // make the run depend on the network.
  await context.route(/^https?:\/\/(?!(localhost|127\.0\.0\.1)[:/])/, (route) => route.abort())

  await context.route('**/.pas/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/.pas/auth/me') {
      const row = db.users.find((u) => u.id === me)
      if (!me) return route.fulfill({ status: 401, json: { error: 'not signed in' } })
      return route.fulfill({ json: { id: me, login: row?.name ?? me, name: row?.name ?? me, email: row?.email } })
    }

    // Fire-and-forget membership ping the SDK sends after sign-in.
    if (path === '/.pas/api/v1/apps/grasskarma/roles/ensure-member') return route.fulfill({ json: { ok: true } })
    // The schema is applied by deploy.yml; the client-side migrate is a no-op here.
    if (path === '/.pas/data/migrate') return route.fulfill({ json: { ok: true, applied: [], already: [] } })

    // Sign-in is a top-level navigation to the platform's OAuth start.
    if (path === '/.pas/auth/start') return route.fulfill({ contentType: 'text/html', body: '<title>Signing in</title>' })

    const action = path.match(/^\/\.pas\/api\/v1\/apps\/grasskarma\/actions\/([a-z_]+)$/)?.[1]
    if (action && request.method() === 'POST') {
      platform.calls.push(action)
      if (!me) return route.fulfill({ status: 401, json: { error: 'not signed in' } })
      const params = ((request.postDataJSON() as { params?: Params } | null)?.params ?? {}) as Params
      // The newcomer exists as a platform identity with no GrassKarma profile
      // until it picks a role, so it lands on the role picker.
      if (persona === 'newcomer' && action === 'get_user' && params.id === me && !platform.mutations.some((m) => m.name === 'create_me')) {
        return route.fulfill({ json: { rows: [] } })
      }
      const rows = query(db, me, action, params)
      if (rows) return route.fulfill({ json: { rows } })
      const result = mutationResult(action)
      if (result) {
        platform.mutations.push({ name: action, params })
        return route.fulfill({ json: result })
      }
    }

    platform.unhandled.push(`${request.method()} ${path}`)
    return route.fulfill({ status: 404, json: { error: 'not mocked' } })
  })

  return platform
}
