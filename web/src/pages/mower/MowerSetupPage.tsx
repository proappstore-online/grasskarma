import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { updateUser } from '../../lib/users'

export default function MowerSetupPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [suburb, setSuburb] = useState('')
  const [postcode, setPostcode] = useState('')
  const [serviceRadiusKm, setRadius] = useState('5')
  const [ratePerM2, setRate] = useState('')
  const [bio, setBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.mowerProfile) {
      setSuburb(user.mowerProfile.suburb ?? '')
      setPostcode(user.mowerProfile.postcode ?? '')
      setRadius(String(user.mowerProfile.serviceRadiusKm ?? 5))
      setRate(user.mowerProfile.ratePerM2 ? String(user.mowerProfile.ratePerM2) : '')
      setBio(user.mowerProfile.bio ?? '')
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    if (!suburb.trim() || !/^\d{4}$/.test(postcode.trim())) {
      setError('Suburb and 4-digit postcode are required.')
      return
    }
    const r = Number(serviceRadiusKm)
    if (!Number.isFinite(r) || r <= 0) {
      setError('Service radius must be a positive number.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateUser(user.id, {
        suburb: suburb.trim(),
        postcode: postcode.trim(),
        mowerProfile: {
          suburb: suburb.trim(),
          postcode: postcode.trim(),
          serviceRadiusKm: r,
          ratePerM2: ratePerM2 ? Number(ratePerM2) : undefined,
          bio: bio.trim() || undefined,
        },
      })
      await refresh()
      navigate('/mower', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="display-font text-2xl font-bold">Set up your mower profile</h1>
      <p className="text-sm text-[var(--muted)]">
        Tell street groups where you work and how much you charge.
      </p>

      <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <Field label="Suburb" value={suburb} onChange={setSuburb} />
        <Field label="Postcode" value={postcode} onChange={setPostcode} inputMode="numeric" maxLength={4} />
        <Field label="Service radius (km)" value={serviceRadiusKm} onChange={setRadius} type="number" />
        <Field label="Rate per m² ($)" value={ratePerM2} onChange={setRate} type="number" />
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: 'numeric' | 'decimal'
  maxLength?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
      />
    </div>
  )
}
