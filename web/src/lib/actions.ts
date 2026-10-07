import { app } from './app'
import { ROLES, SCHEDULE_STATUSES, SELF_SELECTABLE_ROLES, STREET_GROUP_STATUSES } from '../models'

/**
 * Client-side mirror of the registered-action manifest in the repository root
 * `mcp.json`. It is deliberately data rather than loose string unions, so
 * action names, parameter names and parameter value types share one contract.
 * actions.contract.test.ts verifies this mirror against mcp.json.
 */
type Parameter<T, Optional extends boolean = false> = {
  type: 'string' | 'number' | 'integer'
  optional: Optional
  values?: readonly T[]
}

type ActionDefinition = {
  operation: 'query' | 'execute' | 'batch'
  params: Record<string, Parameter<unknown, boolean>>
}

const string = (): Parameter<string> => ({ type: 'string', optional: false })
const number = (): Parameter<number> => ({ type: 'number', optional: false })
const integer = (): Parameter<number> => ({ type: 'integer', optional: false })
const values = <T extends string>(allowed: readonly T[]): Parameter<T> => ({ type: 'string', optional: false, values: allowed })
const integerValues = <T extends number>(allowed: readonly T[]): Parameter<T> => ({ type: 'integer', optional: false, values: allowed })
const optional = <T>(parameter: Parameter<T>): Parameter<T, true> => ({ ...parameter, optional: true })

export const ACTION_MANIFEST = {
  get_user: { operation: 'query', params: { id: string() } },
  list_users: { operation: 'query', params: { role: optional(values(ROLES)), suburb: optional(string()), postcode: optional(string()), limit: optional(integer()) } },
  get_public_mower_contact: { operation: 'query', params: { mower_id: string() } },
  create_me: { operation: 'execute', params: { email: optional(string()), name: optional(string()), photo_url: optional(string()), role: values(SELF_SELECTABLE_ROLES), suburb: optional(string()), postcode: optional(string()), state: optional(string()), country: optional(string()), lat: optional(number()), lng: optional(number()), client_profile: optional(string()), mower_profile: optional(string()) } },
  update_me: { operation: 'execute', params: { email: optional(string()), set_email: optional(integer()), public_contact_email: optional(string()), set_public_contact_email: optional(integer()), name: optional(string()), set_name: optional(integer()), photo_url: optional(string()), set_photo_url: optional(integer()), suburb: optional(string()), set_suburb: optional(integer()), postcode: optional(string()), set_postcode: optional(integer()), state: optional(string()), set_state: optional(integer()), country: optional(string()), set_country: optional(integer()), lat: optional(number()), set_lat: optional(integer()), lng: optional(number()), set_lng: optional(integer()), client_profile: optional(string()), set_client_profile: optional(integer()), mower_profile: optional(string()), set_mower_profile: optional(integer()), street_group_id: optional(string()), set_street_group_id: optional(integer()) } },
  record_photo_object: { operation: 'execute', params: { storage_key: string() } },
  queue_photo_cleanup: { operation: 'execute', params: { storage_keys: string() } },
  list_photo_cleanup_jobs: { operation: 'query', params: {} },
  complete_photo_cleanup: { operation: 'batch', params: { storage_key: string() } },
  admin_set_role: { operation: 'execute', params: { user_id: string(), role: values(ROLES) } },
  admin_delete_user: { operation: 'batch', params: { user_id: string(), photo_keys: optional(string()) } },
  list_groups: { operation: 'query', params: { status: optional(values(STREET_GROUP_STATUSES)), suburb: optional(string()), postcode: optional(string()), mower_id: optional(string()), limit: optional(integer()) } },
  get_group: { operation: 'query', params: { id: string() } },
  create_group: { operation: 'batch', params: { id: string(), name: string(), street_name: optional(string()), suburb: optional(string()), postcode: optional(string()), state: optional(string()), country: optional(string()), center_lat: optional(number()), center_lng: optional(number()) } },
  find_group_by_location: { operation: 'query', params: { street_name: string(), suburb: string(), postcode: string() } },
  update_group: { operation: 'execute', params: { id: string(), name: optional(string()), set_name: optional(integer()), street_name: optional(string()), set_street_name: optional(integer()), suburb: optional(string()), set_suburb: optional(integer()), postcode: optional(string()), set_postcode: optional(integer()), state: optional(string()), set_state: optional(integer()), country: optional(string()), set_country: optional(integer()), center_lat: optional(number()), set_center_lat: optional(integer()), center_lng: optional(number()), set_center_lng: optional(integer()), status: optional(values(STREET_GROUP_STATUSES)), set_status: optional(integer()), assigned_mower_id: optional(string()), set_assigned_mower_id: optional(integer()) } },
  add_group_member: { operation: 'batch', params: { group_id: string(), user_id: string() } },
  remove_group_member: { operation: 'batch', params: { group_id: string(), user_id: string() } },
  add_group_admin: { operation: 'execute', params: { group_id: string(), user_id: string() } },
  remove_group_admin: { operation: 'execute', params: { group_id: string(), user_id: string() } },
  delete_group: { operation: 'batch', params: { group_id: string() } },
  create_group_interest: { operation: 'execute', params: { id: string(), group_id: string(), message: optional(string()) } },
  list_group_interests: { operation: 'query', params: { group_id: string() } },
  delete_group_interest: { operation: 'execute', params: { id: string() } },
  approve_group_interest: { operation: 'batch', params: { group_id: string(), interest_id: string(), user_id: string() } },
  list_schedules: { operation: 'query', params: { group_id: string() } },
  list_schedules_for_mower: { operation: 'query', params: { limit: optional(integer()) } },
  create_schedule: { operation: 'execute', params: { id: string(), group_id: string(), day_of_week: optional(integer()), start_time: optional(string()), mower_id: optional(string()), due_date: optional(integer()) } },
  update_schedule: { operation: 'execute', params: { id: string(), day_of_week: optional(integer()), set_day_of_week: optional(integer()), start_time: optional(string()), set_start_time: optional(integer()), mower_id: optional(string()), set_mower_id: optional(integer()), status: optional(values(SCHEDULE_STATUSES)), set_status: optional(integer()), due_date: optional(integer()), set_due_date: optional(integer()), completed_at: optional(integer()), set_completed_at: optional(integer()) } },
  complete_schedule: { operation: 'batch', params: { schedule_id: string(), group_id: string(), history_id: string(), street_name: optional(string()), area_sqm: optional(integer()), duration_min: optional(integer()), income: optional(integer()), date: integer() } },
  delete_schedule: { operation: 'execute', params: { id: string() } },
  create_review: { operation: 'execute', params: { id: string(), mower_id: string(), group_id: optional(string()), schedule_id: optional(string()), rating: integer(), comment: optional(string()) } },
  list_reviews: { operation: 'query', params: { mower_id: string() } },
  update_review: { operation: 'execute', params: { id: string(), rating: optional(integer()), set_rating: optional(integer()), comment: optional(string()), set_comment: optional(integer()) } },
  delete_review: { operation: 'execute', params: { id: string() } },
  average_rating: { operation: 'query', params: { mower_id: string() } },
  record_history: { operation: 'execute', params: { id: string(), group_id: optional(string()), schedule_id: optional(string()), street_name: optional(string()), area_sqm: optional(integer()), duration_min: optional(integer()), income: optional(integer()), date: integer() } },
  list_history: { operation: 'query', params: { mower_id: string(), limit: optional(integer()) } },
  list_interests_for_group: { operation: 'query', params: { group_id: string() } },
  list_interests_for_mower: { operation: 'query', params: {} },
  create_mower_interest: { operation: 'execute', params: { id: string(), group_id: string(), message: optional(string()) } },
  delete_mower_interest: { operation: 'batch', params: { id: string() } },
  cast_vote: { operation: 'execute', params: { interest_id: string(), vote: integerValues([-1, 1] as const) } },
  list_votes: { operation: 'query', params: { interest_id: string() } },
  vote_tally: { operation: 'query', params: { interest_id: string() } },
} as const satisfies Record<string, ActionDefinition>

export type ActionName = keyof typeof ACTION_MANIFEST
type ActionOf<Operation extends ActionDefinition['operation']> = {
  [Name in ActionName]: (typeof ACTION_MANIFEST)[Name]['operation'] extends Operation ? Name : never
}[ActionName]
export type QueryActionName = ActionOf<'query'>
export type MutationActionName = ActionOf<'execute' | 'batch'>
export type BatchActionName = ActionOf<'batch'>

type ParameterValue<Definition> = Definition extends Parameter<infer Value, boolean> ? Value : never
type OptionalParameterKeys<Name extends ActionName> = {
  [Key in keyof (typeof ACTION_MANIFEST)[Name]['params']]: (typeof ACTION_MANIFEST)[Name]['params'][Key] extends Parameter<unknown, true> ? Key : never
}[keyof (typeof ACTION_MANIFEST)[Name]['params']]
type RequiredParameterKeys<Name extends ActionName> = Exclude<keyof (typeof ACTION_MANIFEST)[Name]['params'], OptionalParameterKeys<Name>>

/** The exact parameter shape accepted by a registered action. */
export type ActionParams<Name extends ActionName> =
  & { [Key in RequiredParameterKeys<Name>]: ParameterValue<(typeof ACTION_MANIFEST)[Name]['params'][Key]> }
  & { [Key in OptionalParameterKeys<Name>]?: ParameterValue<(typeof ACTION_MANIFEST)[Name]['params'][Key]> | null }

type ActionArguments<Name extends ActionName> = RequiredParameterKeys<Name> extends never
  ? [params?: ActionParams<Name>]
  : [params: ActionParams<Name>]

export interface ActionMeta {
  changes: number
  duration?: number
  last_row_id?: number
}

/** A conditional server-side write was rejected or its target became stale. */
export class ActionRefusedError extends Error {
  constructor(action: ActionName) {
    super(`${action} was refused by the server. Your permissions or the underlying record may have changed; reload and try again.`)
    this.name = 'ActionRefusedError'
  }
}

function validateActionCall<Name extends ActionName>(name: Name, params: ActionParams<Name>): void {
  const definition = ACTION_MANIFEST[name]
  for (const key of Object.keys(params)) {
    if (!(key in definition.params)) throw new Error(`${name} does not accept parameter ${key}.`)
  }
  for (const [key, parameter] of Object.entries(definition.params)) {
    const value = (params as Record<string, unknown>)[key]
    if (value == null) {
      if (!parameter.optional) throw new Error(`${name} requires parameter ${key}.`)
      continue
    }
    if ((parameter.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) || (parameter.type !== 'integer' && typeof value !== parameter.type)) {
      throw new Error(`${name}.${key} must be a ${parameter.type}.`)
    }
    if (parameter.values && !parameter.values.includes(value as never)) {
      throw new Error(`${name}.${key} must be one of ${parameter.values.join(', ')}.`)
    }
  }
}

/** Call a query action; resolves to the result rows. */
export async function q<T, Name extends QueryActionName = QueryActionName>(name: Name, ...[params = {} as ActionParams<Name>]: ActionArguments<Name>): Promise<T[]> {
  validateActionCall(name, params)
  const res = await app.actions.call<{ rows: T[] }>(name, params)
  return res.rows
}

/** Call an execute or batch action; resolves to the write metadata. */
export async function x<Name extends MutationActionName>(name: Name, ...[params = {} as ActionParams<Name>]: ActionArguments<Name>): Promise<ActionMeta> {
  validateActionCall(name, params)
  const res = await app.actions.call<{ meta: ActionMeta }>(name, params)
  return res.meta
}

/** Contract for a guarded single-statement mutation: it must affect one row. */
export async function xOne<Name extends MutationActionName>(name: Name, ...args: ActionArguments<Name>): Promise<ActionMeta> {
  const meta = await x(name, ...args)
  if (meta.changes !== 1) throw new ActionRefusedError(name)
  return meta
}

/** Contract for transactional actions whose final sentinel write affects one row. */
export async function xBatch<Name extends BatchActionName>(name: Name, ...args: ActionArguments<Name>): Promise<ActionMeta> {
  return xOne(name, ...args)
}
