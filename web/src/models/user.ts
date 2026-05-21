// Domain shape. All dates are epoch-millis integers (vs the source repo's Date
// objects — Firestore Timestamp is gone, so we don't round-trip through Date
// either).

export type Role = 'client' | 'mower' | 'admin'

export interface ClientProfile {
  street?: string
  addressNumber?: string
  suburb?: string
  postcode?: string
  state?: string
  country?: string
  lawnAreaM2?: number
  natureStripPhotos?: string[]
  profileCompleted?: boolean
  bio?: string
  website?: string
  linkedin?: string
}

export interface MowerProfile {
  addressNumber?: string
  homeStreetName?: string
  suburb?: string
  postcode?: string
  serviceRadiusKm: number
  // rate_per_sqm stays in the schema but is informational, not transactional
  // in v1 — payments are deferred to the platform Marketplace API.
  ratePerM2?: number
  bio?: string
}

export interface User {
  id: string
  email: string | null
  name: string | null
  photoUrl: string | null
  role: Role | null
  suburb: string | null
  postcode: string | null
  state: string | null
  country: string | null
  lat: number | null
  lng: number | null
  clientProfile: ClientProfile | null
  mowerProfile: MowerProfile | null
  streetGroupId: string | null
  createdAt: number
  updatedAt: number
}
