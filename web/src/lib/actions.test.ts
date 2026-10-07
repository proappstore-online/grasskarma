import { beforeEach, describe, expect, it, vi } from 'vitest'

const call = vi.hoisted(() => vi.fn())

vi.mock('./app', () => ({ app: { actions: { call } } }))

import { ActionRefusedError, xBatch, xOne } from './actions'

beforeEach(() => {
  call.mockReset()
})

describe('guarded action contracts', () => {
  it('turns a zero-row guarded mutation into a clear refusal', async () => {
    call.mockResolvedValue({ meta: { changes: 0 } })
    await expect(xOne('admin_set_role', { user_id: 'u1', role: 'mower' })).rejects.toBeInstanceOf(ActionRefusedError)
  })

  it('requires the final sentinel statement of a batch to affect one row', async () => {
    call.mockResolvedValue({ meta: { changes: 0 } })
    await expect(xBatch('admin_delete_user', { user_id: 'u1' })).rejects.toBeInstanceOf(ActionRefusedError)
  })

  it('returns metadata only for an exactly-one-row mutation', async () => {
    call.mockResolvedValue({ meta: { changes: 1, duration: 4 } })
    await expect(xOne('update_schedule', { id: 's1' })).resolves.toEqual({ changes: 1, duration: 4 })
  })
})
