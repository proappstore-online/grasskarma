/** The canonical lifecycle values for a street group. */
export const STREET_GROUP_STATUSES = ['forming', 'active', 'paused', 'archived'] as const
export type StreetGroupStatus = typeof STREET_GROUP_STATUSES[number]

export interface StreetGroup {
  id: string
  name: string
  streetName: string | null
  suburb: string | null
  postcode: string | null
  state: string | null
  country: string | null
  centerLat: number | null
  centerLng: number | null
  adminIds: string[]
  memberIds: string[]
  assignedMowerId: string | null
  status: StreetGroupStatus
  createdAt: number
  updatedAt: number
}
