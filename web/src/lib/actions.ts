import { app } from './app'

/**
 * Registered-action helpers. Every user-facing read/write goes through
 * `app.actions.call` (platform-prepared, role-checked SQL registered in
 * mcp.json) instead of raw browser SQL — the data worker only accepts raw
 * SQL from the app's own team since the cross-tenant lockdown.
 */

export interface ActionMeta {
  changes: number
  duration?: number
  last_row_id?: number
}

/** A conditional server-side write was rejected or its target became stale. */
export class ActionRefusedError extends Error {
  constructor(action: string) {
    super(`${action} was refused by the server. Your permissions or the underlying record may have changed; reload and try again.`)
    this.name = 'ActionRefusedError'
  }
}

/** Call a query action; resolves to the result rows. */
export async function q<T>(name: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const res = await app.actions.call<{ rows: T[] }>(name, params)
  return res.rows
}

/** Call an execute action; resolves to the write metadata. */
export async function x(name: string, params: Record<string, unknown> = {}): Promise<ActionMeta> {
  const res = await app.actions.call<{ meta: ActionMeta }>(name, params)
  return res.meta
}

/**
 * Contract for a guarded single-statement mutation: it must affect exactly one
 * row. A zero-row response is never a successful UI mutation.
 */
export async function xOne(name: string, params: Record<string, unknown> = {}): Promise<ActionMeta> {
  const meta = await x(name, params)
  if (meta.changes !== 1) throw new ActionRefusedError(name)
  return meta
}

/**
 * Contract for a transactional registered action. The data service exposes the
 * metadata for the batch's final statement; every batch used here ends with a
 * guarded sentinel write (the primary record delete/update/insert). It must
 * therefore affect exactly one row for the batch to be considered successful.
 */
export async function xBatch(name: string, params: Record<string, unknown> = {}): Promise<ActionMeta> {
  return xOne(name, params)
}
