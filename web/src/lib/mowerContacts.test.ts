// Contact is intentionally separate from account email. Exercise the deployed
// migration and registered action so a client can reach an opted-in mower
// without the directory exposing the mower's private account address.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { mowerContactHref, normalizePublicContactEmail } from './mowerContacts'

type Tool = { name: string; sql?: string }
type Migration = { name: string; sql: string }

const root = new URL('../../../', import.meta.url)
const migrations: { migrations: Migration[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools

let db: DatabaseSync

function action(name: string): string {
  const sql = tools.find((tool) => tool.name === name)?.sql
  if (!sql) throw new Error(`Missing ${name}`)
  return sql
}

function bind(sql: string, params: Record<string, string | number | null>, userId: string) {
  const values: Record<string, string | number | null> = { __user_id: userId, __now: 1_700_000_000_000, ...params }
  const args: (string | number | null)[] = []
  return {
    text: sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
      args.push(values[name] ?? null)
      return '?'
    }),
    args,
  }
}

function query(name: string, userId: string, params: Record<string, string | number | null>) {
  const statement = bind(action(name), params, userId)
  return db.prepare(statement.text).all(...statement.args)
}

function execute(name: string, userId: string, params: Record<string, string | number | null>) {
  const statement = bind(action(name), params, userId)
  return db.prepare(statement.text).run(...statement.args)
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
})

describe('public mower contact', () => {
  it('adds a constrained opt-in field and exposes only that field through the contact action', () => {
    db.prepare("INSERT INTO users (id, email, role, public_contact_email, created_at, updated_at) VALUES ('mower', 'private@example.com', 'mower', 'hire@example.com', 1, 1)").run()
    db.prepare("INSERT INTO users (id, email, role, created_at, updated_at) VALUES ('client', 'client@example.com', 'client', 1, 1)").run()

    expect(query('get_public_mower_contact', 'client', { mower_id: 'mower' }))
      .toEqual([{ public_contact_email: 'hire@example.com' }])
    expect(query('get_public_mower_contact', 'client', { mower_id: 'client' })).toEqual([])
    expect(() => db.prepare("UPDATE users SET public_contact_email = 'not an email' WHERE id = 'mower'").run())
      .toThrow(/CHECK constraint failed/)
  })

  it('lets only a mower publish or clear their own contact address', () => {
    db.prepare("INSERT INTO users (id, role, created_at, updated_at) VALUES ('mower', 'mower', 1, 1)").run()
    db.prepare("INSERT INTO users (id, role, created_at, updated_at) VALUES ('client', 'client', 1, 1)").run()
    const params = {
      set_email: 0, set_public_contact_email: 1, public_contact_email: 'hire@example.com',
      set_name: 0, set_photo_url: 0, set_suburb: 0, set_postcode: 0, set_state: 0,
      set_country: 0, set_lat: 0, set_lng: 0, set_client_profile: 0,
      set_mower_profile: 0, set_street_group_id: 0, street_group_id: null,
    }

    execute('update_me', 'mower', params)
    execute('update_me', 'client', params)

    expect(db.prepare("SELECT public_contact_email FROM users WHERE id = 'mower'").get())
      .toEqual({ public_contact_email: 'hire@example.com' })
    expect(db.prepare("SELECT public_contact_email FROM users WHERE id = 'client'").get())
      .toEqual({ public_contact_email: null })
  })

  it('builds a mail action only for a valid opt-in address', () => {
    expect(normalizePublicContactEmail('  hire@example.com ')).toBe('hire@example.com')
    expect(normalizePublicContactEmail('')).toBeNull()
    expect(() => normalizePublicContactEmail('not-an-email')).toThrow('valid public contact')
    expect(mowerContactHref('hire@example.com')).toBe('mailto:hire@example.com')
  })
})
