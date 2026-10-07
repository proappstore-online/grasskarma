// Execute the shipped registered-action SQL against SQLite. Membership has two
// representations, so these tests cover both the successful transitions and
// the denial/error boundaries that must not leave only one representation set.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

type Tool = {
  name: string
  operation: 'query' | 'execute' | 'batch'
  sql?: string
  statements?: string[]
}

const root = new URL('../../../', import.meta.url)
const migrations: { migrations: { sql: string }[] } = JSON.parse(readFileSync(new URL('migrations.json', root), 'utf8'))
const tools: Tool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools

let db: DatabaseSync

function action(name: string): Tool {
  const tool = tools.find((candidate) => candidate.name === name)
  if (!tool) throw new Error(`Missing action ${name}`)
  return tool
}

function bind(sql: string, params: Record<string, unknown>, userId: string) {
  const values: Record<string, unknown> = { __user_id: userId, __now: 1_700_000_000_000, ...params }
  const args: (string | number | null)[] = []
  const text = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    const value = values[name] ?? null
    if (typeof value !== 'string' && typeof value !== 'number' && value !== null) throw new Error(`Unsupported SQL value for ${name}`)
    args.push(value)
    return '?'
  })
  return { text, args }
}

/** Registered batch actions execute as one transaction in the data worker. */
function call(name: string, userId: string, params: Record<string, unknown> = {}) {
  const tool = action(name)
  const statements = tool.statements ?? [tool.sql!]
  db.exec('BEGIN')
  try {
    for (const sql of statements) {
      const { text, args } = bind(sql, params, userId)
      db.prepare(text).run(...args)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function user(id: string, role: 'client' | 'mower' | 'admin' = 'client', groupId: string | null = null) {
  db.prepare('INSERT INTO users (id, role, street_group_id, created_at, updated_at) VALUES (?, ?, ?, 1, 1)').run(id, role, groupId)
}

function group(id = 'g1', admins = ['admin'], members = ['admin']) {
  db.prepare("INSERT INTO street_groups (id, name, admin_ids, member_ids, status, created_at, updated_at) VALUES (?, 'Maple St', ?, ?, 'forming', 1, 1)")
    .run(id, JSON.stringify(admins), JSON.stringify(members))
}

function pointer(id: string): string | null {
  return (db.prepare('SELECT street_group_id FROM users WHERE id = ?').get(id) as { street_group_id: string | null }).street_group_id
}

function members(id = 'g1'): string[] {
  return JSON.parse((db.prepare('SELECT member_ids FROM street_groups WHERE id = ?').get(id) as { member_ids: string }).member_ids) as string[]
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  for (const migration of migrations.migrations) db.exec(migration.sql)
})

describe('street-group membership actions', () => {
  it('uses transactional batches for every transition that changes either membership representation', () => {
    for (const name of ['create_group', 'add_group_member', 'remove_group_member', 'delete_group']) {
      const tool = action(name)
      expect(tool.operation, name).toBe('batch')
      expect(tool.statements, name).toHaveLength(name === 'delete_group' ? 6 : 2)
    }
  })

  it('creates the group and the creator pointer together', () => {
    user('creator')

    call('create_group', 'creator', { id: 'created', name: 'Created St' })

    expect(members('created')).toEqual(['creator'])
    expect(pointer('creator')).toBe('created')
  })

  it('does not create a group or change a pointer when the creator is already in another group', () => {
    user('creator', 'client', 'existing')

    call('create_group', 'creator', { id: 'rejected', name: 'Rejected St' })

    expect(db.prepare('SELECT id FROM street_groups WHERE id = ?').get('rejected')).toBeUndefined()
    expect(pointer('creator')).toBe('existing')
  })

  it('approves and removes a member while updating their pointer in the same transition', () => {
    user('admin')
    user('client')
    group()

    call('add_group_member', 'admin', { group_id: 'g1', user_id: 'client' })
    expect(members()).toEqual(['admin', 'client'])
    expect(pointer('client')).toBe('g1')

    call('remove_group_member', 'admin', { group_id: 'g1', user_id: 'client' })
    expect(members()).toEqual(['admin'])
    expect(pointer('client')).toBeNull()
  })

  it('rolls back the member-list update if setting the pointer fails', () => {
    user('admin')
    user('client')
    group()
    db.exec("CREATE TRIGGER reject_member_pointer BEFORE UPDATE OF street_group_id ON users WHEN NEW.id = 'client' BEGIN SELECT RAISE(ABORT, 'pointer rejected'); END")

    expect(() => call('add_group_member', 'admin', { group_id: 'g1', user_id: 'client' })).toThrow('pointer rejected')

    expect(members()).toEqual(['admin'])
    expect(pointer('client')).toBeNull()
  })

  it('denies an unauthorized removal without clearing the user pointer', () => {
    user('admin')
    user('client', 'client', 'g1')
    user('outsider')
    group('g1', ['admin'], ['admin', 'client'])

    call('remove_group_member', 'outsider', { group_id: 'g1', user_id: 'client' })

    expect(members()).toEqual(['admin', 'client'])
    expect(pointer('client')).toBe('g1')
  })

  it('clears every group pointer before an authorized group deletion, including stale pointers', () => {
    user('admin', 'client', 'g1')
    user('client', 'client', 'g1')
    user('stale', 'client', 'g1')
    group('g1', ['admin'], ['admin', 'client'])

    call('delete_group', 'admin', { group_id: 'g1' })

    expect(db.prepare('SELECT id FROM street_groups WHERE id = ?').get('g1')).toBeUndefined()
    expect(pointer('admin')).toBeNull()
    expect(pointer('client')).toBeNull()
    expect(pointer('stale')).toBeNull()
  })
})
