import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => vi.fn())
vi.mock('./app', () => ({ app: { actions: { call } } }))

import { ACTION_MANIFEST, q, xOne, type ActionName, type ActionParams } from './actions'

type RegisteredTool = {
  name: string
  operation: 'query' | 'execute' | 'batch'
  params?: Record<string, { type: 'string' | 'number' | 'integer'; optional?: boolean }>
}

const root = new URL('../../../', import.meta.url)
const registeredTools: RegisteredTool[] = JSON.parse(readFileSync(new URL('mcp.json', root), 'utf8')).tools

describe('registered action contract', () => {
  it('matches every registered action name, operation, and parameter declaration', () => {
    expect(Object.keys(ACTION_MANIFEST).sort()).toEqual(registeredTools.map((tool) => tool.name).sort())

    for (const tool of registeredTools) {
      const contract = ACTION_MANIFEST[tool.name as ActionName]
      expect(contract.operation).toBe(tool.operation)
      expect(Object.keys(contract.params).sort()).toEqual(Object.keys(tool.params ?? {}).sort())
      const contractParams = contract.params as Record<string, { type: string; optional: boolean }>
      for (const [name, parameter] of Object.entries(tool.params ?? {})) {
        expect(contractParams[name]).toMatchObject({ type: parameter.type, optional: parameter.optional === true })
      }
    }
  })

  it('rejects stale parameter names and invalid enum values before dispatching', async () => {
    await expect(q('get_user', { id: 'u1', stale: true } as never)).rejects.toThrow('does not accept parameter stale')
    await expect(xOne('admin_set_role', { user_id: 'u1', role: 'owner' as never })).rejects.toThrow('must be one of')
    expect(call).not.toHaveBeenCalled()
  })
})

// Compile-time action-name and payload checks. These are intentionally kept in
// the test program so tsc fails if the contract ever becomes permissive.
const validRoleChange: ActionParams<'admin_set_role'> = { user_id: 'u1', role: 'mower' }
void validRoleChange
if (false) {
  // @ts-expect-error stale action names are not callable
  void xOne('set_user_role', { user_id: 'u1', role: 'mower' })
  // @ts-expect-error query actions cannot be passed to a mutation helper
  void xOne('get_user', { id: 'u1' })
  // @ts-expect-error registered payloads reject stale keys
  void xOne('admin_set_role', { user_id: 'u1', role: 'mower', owner_id: 'u1' })
}
// @ts-expect-error role values come from the domain constant
const invalidRole: ActionParams<'admin_set_role'> = { user_id: 'u1', role: 'owner' }
void invalidRole
