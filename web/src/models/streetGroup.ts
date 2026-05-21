export type StreetGroupStatus = 'forming' | 'active' | 'paused' | 'archived'

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
