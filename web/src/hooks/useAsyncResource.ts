import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { DependencyList } from 'react'

export interface AsyncResourceState<T> {
  data: T | null
  error: unknown | null
  loading: boolean
}

type AsyncResourceAction<T> =
  | { type: 'start' }
  | { type: 'success'; data: T }
  | { type: 'error'; error: unknown }
  | { type: 'reset' }
  | { type: 'update'; update: (data: T | null) => T | null }

export interface AsyncResourceCommit {
  requestGeneration: number
  activeGeneration: number
  mounted: boolean
}

/** Whether a request is still the resource's most recent live request. */
export function shouldCommitAsyncResource({ requestGeneration, activeGeneration, mounted }: AsyncResourceCommit) {
  return mounted && requestGeneration === activeGeneration
}

export function reduceAsyncResource<T>(state: AsyncResourceState<T>, action: AsyncResourceAction<T>): AsyncResourceState<T> {
  switch (action.type) {
    case 'start':
      return { ...state, loading: true, error: null }
    case 'success':
      return { data: action.data, error: null, loading: false }
    case 'error':
      return { ...state, error: action.error, loading: false }
    case 'reset':
      return { data: null, error: null, loading: false }
    case 'update':
      return { ...state, data: action.update(state.data) }
  }
}

export interface UseAsyncResourceOptions {
  /** Set false when the request cannot yet be made (for example, before auth has loaded). */
  enabled?: boolean
}

export interface AsyncResource<T> extends AsyncResourceState<T> {
  reload: () => Promise<void>
  reset: () => void
  updateData: (update: (data: T | null) => T | null) => void
}

/**
 * Runs an async page request whenever `dependencies` change.
 *
 * A new request invalidates all earlier requests. Results are committed only
 * while the component is mounted and the result still belongs to the latest
 * generation, so callers do not need local `alive` flags.
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  dependencies: DependencyList,
  { enabled = true }: UseAsyncResourceOptions = {},
): AsyncResource<T> {
  const [state, dispatch] = useReducer(reduceAsyncResource<T>, { data: null, error: null, loading: enabled })
  const mounted = useRef(false)
  const generation = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    const requestGeneration = ++generation.current
    dispatch({ type: 'start' })
    try {
      const data = await loadRef.current()
      if (shouldCommitAsyncResource({ requestGeneration, activeGeneration: generation.current, mounted: mounted.current })) {
        dispatch({ type: 'success', data })
      }
    } catch (error) {
      if (shouldCommitAsyncResource({ requestGeneration, activeGeneration: generation.current, mounted: mounted.current })) {
        dispatch({ type: 'error', error })
      }
    }
  }, [])

  const reset = useCallback(() => {
    ++generation.current
    if (mounted.current) dispatch({ type: 'reset' })
  }, [])

  const updateData = useCallback((update: (data: T | null) => T | null) => {
    if (mounted.current) dispatch({ type: 'update', update })
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      ++generation.current
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      reset()
      return
    }
    void reload()
    return () => {
      ++generation.current
    }
    // The caller explicitly controls refreshes through dependencies. `reload`
    // is stable and `reset` is only used for disabled resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, reset, ...dependencies])

  return { ...state, reload, reset, updateData }
}
