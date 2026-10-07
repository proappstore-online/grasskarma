import type { MowerProfile } from '../models'
import { normalizePublicContactEmail } from './mowerContacts'

/** The two screens use the same fields but have different completion rules. */
export const MOWER_PROFILE_FORM_MODES = ['setup', 'edit'] as const
export type MowerProfileFormMode = typeof MOWER_PROFILE_FORM_MODES[number]

/**
 * Form values stay as strings so a user can finish typing a number without
 * the UI coercing it on every keystroke. Convert them only at the save edge.
 */
export interface MowerProfileDraft {
  suburb: string
  postcode: string
  serviceRadiusKm: string
  ratePerM2: string
  bio: string
  publicContactEmail: string
}

export interface SerializedMowerProfileDraft {
  suburb: string | null
  postcode: string | null
  publicContactEmail: string | null
  mowerProfile: MowerProfile
}

function optionalText(value: string): string | undefined {
  return value.trim() || undefined
}

function optionalNumber(value: string): number | undefined {
  const text = value.trim()
  if (!text) return undefined
  const number = Number(text)
  return Number.isFinite(number) ? number : undefined
}

function radiusNumber(value: string): number {
  return optionalNumber(value) ?? 0
}

export function createMowerProfileDraft(
  profile: MowerProfile | null | undefined,
  publicContactEmail: string | null | undefined,
  mode: MowerProfileFormMode,
): MowerProfileDraft {
  return {
    suburb: profile?.suburb ?? '',
    postcode: profile?.postcode ?? '',
    serviceRadiusKm: profile?.serviceRadiusKm != null
      ? String(profile.serviceRadiusKm)
      : mode === 'setup' ? '5' : '0',
    ratePerM2: profile?.ratePerM2 != null ? String(profile.ratePerM2) : '',
    bio: profile?.bio ?? '',
    publicContactEmail: publicContactEmail ?? '',
  }
}

/**
 * Setup is a completion gate, while profile editing deliberately permits
 * incomplete legacy profiles. Keeping this mode here documents that contract
 * instead of allowing the two pages to drift again.
 */
export function validateMowerProfileDraft(
  draft: MowerProfileDraft,
  mode: MowerProfileFormMode,
): string | null {
  if (mode === 'edit') return null

  if (!draft.suburb.trim() || !/^\d{4}$/.test(draft.postcode.trim())) {
    return 'Suburb and 4-digit postcode are required.'
  }
  const radius = optionalNumber(draft.serviceRadiusKm)
  if (radius == null || radius <= 0) {
    return 'Service radius must be a positive number.'
  }
  return null
}

/** Normalize exactly once at the persistence boundary for both form screens. */
export function serializeMowerProfileDraft(draft: MowerProfileDraft): SerializedMowerProfileDraft {
  const suburb = optionalText(draft.suburb)
  const postcode = optionalText(draft.postcode)

  return {
    suburb: suburb ?? null,
    postcode: postcode ?? null,
    publicContactEmail: normalizePublicContactEmail(draft.publicContactEmail),
    mowerProfile: {
      suburb,
      postcode,
      serviceRadiusKm: radiusNumber(draft.serviceRadiusKm),
      ratePerM2: optionalNumber(draft.ratePerM2),
      bio: optionalText(draft.bio),
    },
  }
}
