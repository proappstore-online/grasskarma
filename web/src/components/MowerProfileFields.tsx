import type { MowerProfileDraft } from '../lib/mowerProfileForm'

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  inputMode?: 'numeric' | 'decimal'
  maxLength?: number
}

/** Shared labelled input used by the mower setup and profile editor. */
export function LabeledField({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  maxLength,
}: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
    </div>
  )
}

export function LabeledTextArea({
  label,
  value,
  onChange,
  rows = 4,
}: FieldProps & { rows?: number }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
    </div>
  )
}

export function MowerProfileFields({
  draft,
  onChange,
  publicContactDescription,
  bioRows,
}: {
  draft: MowerProfileDraft
  onChange: (draft: MowerProfileDraft) => void
  publicContactDescription: string
  bioRows?: number
}) {
  const update = (key: keyof MowerProfileDraft) => (value: string) => onChange({ ...draft, [key]: value })

  return (
    <>
      <LabeledField label="Suburb" value={draft.suburb} onChange={update('suburb')} />
      <LabeledField
        label="Postcode"
        value={draft.postcode}
        onChange={update('postcode')}
        inputMode="numeric"
        maxLength={4}
      />
      <LabeledField label="Service radius (km)" value={draft.serviceRadiusKm} onChange={update('serviceRadiusKm')} type="number" />
      <LabeledField label="Rate per m² ($)" value={draft.ratePerM2} onChange={update('ratePerM2')} type="number" />
      <LabeledField label="Public contact email" value={draft.publicContactEmail} onChange={update('publicContactEmail')} type="email" />
      <p className="-mt-2 text-xs text-[var(--muted)]">{publicContactDescription}</p>
      <LabeledTextArea label="Bio" value={draft.bio} onChange={update('bio')} rows={bioRows} />
    </>
  )
}
