import { describe, expect, it } from 'vitest'
import { normalizeGroupLocation } from './streetGroups'

describe('street-group location validation', () => {
  it('requires a complete, valid location and trims values before an action call', () => {
    expect(normalizeGroupLocation({ streetName: '  Maple Street  ', suburb: ' North Melbourne ', postcode: ' 3000 ' }))
      .toEqual({ streetName: 'Maple Street', suburb: 'North Melbourne', postcode: '3000' })
    expect(() => normalizeGroupLocation({ streetName: ' ', suburb: 'North Melbourne', postcode: '3000' }))
      .toThrow('Street name is required')
    expect(() => normalizeGroupLocation({ streetName: 'Maple Street', suburb: '', postcode: '300' }))
      .toThrow('Suburb and 4-digit postcode are required')
  })
})
