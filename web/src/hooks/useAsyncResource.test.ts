import { describe, expect, it } from 'vitest'
import { reduceAsyncResource, shouldCommitAsyncResource } from './useAsyncResource'

describe('useAsyncResource contract', () => {
  it('clears an earlier error at the start of the next request and commits its result', () => {
    const failed = reduceAsyncResource({ data: null as string | null, error: null, loading: true }, { type: 'error', error: new Error('nope') })
    const loading = reduceAsyncResource(failed, { type: 'start' })
    const success = reduceAsyncResource(loading, { type: 'success', data: 'fresh' })

    expect(loading).toEqual({ data: null, error: null, loading: true })
    expect(success).toEqual({ data: 'fresh', error: null, loading: false })
  })

  it('resets all resource state and permits page-specific data updates', () => {
    const reset = reduceAsyncResource({ data: ['old'], error: new Error('old'), loading: true }, { type: 'reset' })
    const updated = reduceAsyncResource({ data: ['one'], error: null, loading: false }, { type: 'update', update: (items) => [...(items ?? []), 'two'] })

    expect(reset).toEqual({ data: null, error: null, loading: false })
    expect(updated.data).toEqual(['one', 'two'])
  })

  it('rejects stale and unmounted request results', () => {
    expect(shouldCommitAsyncResource({ requestGeneration: 2, activeGeneration: 3, mounted: true })).toBe(false)
    expect(shouldCommitAsyncResource({ requestGeneration: 3, activeGeneration: 3, mounted: false })).toBe(false)
    expect(shouldCommitAsyncResource({ requestGeneration: 3, activeGeneration: 3, mounted: true })).toBe(true)
  })
})
