import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MowerProfileFields } from '../components/MowerProfileFields'
import {
  createMowerProfileDraft,
  serializeMowerProfileDraft,
  validateMowerProfileDraft,
} from './mowerProfileForm'

describe('mower profile form boundary', () => {
  it('normalizes text, numeric fields, and the explicit public contact on serialization', () => {
    expect(serializeMowerProfileDraft({
      suburb: '  Carlton  ',
      postcode: ' 3053 ',
      serviceRadiusKm: ' 7.5 ',
      ratePerM2: ' 0 ',
      bio: '  Reliable mowing  ',
      publicContactEmail: ' hire@example.com ',
    })).toEqual({
      suburb: 'Carlton',
      postcode: '3053',
      publicContactEmail: 'hire@example.com',
      mowerProfile: {
        suburb: 'Carlton',
        postcode: '3053',
        serviceRadiusKm: 7.5,
        ratePerM2: 0,
        bio: 'Reliable mowing',
      },
    })
  })

  it('serializes blank or malformed optional numbers safely for general editing', () => {
    expect(serializeMowerProfileDraft({
      suburb: ' ', postcode: ' ', serviceRadiusKm: 'not-a-number', ratePerM2: 'nope', bio: ' ', publicContactEmail: '',
    })).toEqual({
      suburb: null,
      postcode: null,
      publicContactEmail: null,
      mowerProfile: { serviceRadiusKm: 0 },
    })
  })

  it('keeps setup as the completion gate while edit mode remains permissive', () => {
    const incomplete = {
      suburb: ' ', postcode: '12', serviceRadiusKm: '0', ratePerM2: '', bio: '', publicContactEmail: '',
    }

    expect(validateMowerProfileDraft(incomplete, 'setup')).toBe('Suburb and 4-digit postcode are required.')
    expect(validateMowerProfileDraft({ ...incomplete, suburb: 'Carlton', postcode: '3053' }, 'setup'))
      .toBe('Service radius must be a positive number.')
    expect(validateMowerProfileDraft(incomplete, 'edit')).toBeNull()
  })

  it('uses the shared labelled field set for both setup and edit drafts', () => {
    const setup = createMowerProfileDraft(null, null, 'setup')
    const edit = createMowerProfileDraft(null, null, 'edit')

    expect(setup.serviceRadiusKm).toBe('5')
    expect(edit.serviceRadiusKm).toBe('0')
    for (const draft of [setup, edit]) {
      const markup = renderToStaticMarkup(
        <MowerProfileFields draft={draft} onChange={vi.fn()} publicContactDescription="Directory-only contact" />,
      )
      expect(markup).toContain('Service radius (km)')
      expect(markup).toContain('Public contact email')
      expect(markup).toContain('<textarea')
    }
  })
})
