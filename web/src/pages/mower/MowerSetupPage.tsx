import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MowerProfileFields } from '../../components/MowerProfileFields'
import { useAuth } from '../../contexts/AuthContext'
import { updateUser } from '../../lib/users'
import {
  createMowerProfileDraft,
  serializeMowerProfileDraft,
  validateMowerProfileDraft,
} from '../../lib/mowerProfileForm'

export default function MowerSetupPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => createMowerProfileDraft(null, null, 'setup'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) setDraft(createMowerProfileDraft(user.mowerProfile, user.publicContactEmail, 'setup'))
  }, [user])

  const handleSave = async () => {
    if (!user) return
    const validationError = validateMowerProfileDraft(draft, 'setup')
    if (validationError) return setError(validationError)
    setSaving(true)
    setError(null)
    try {
      const profile = serializeMowerProfileDraft(draft)
      await updateUser(profile)
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
        <MowerProfileFields
          draft={draft}
          onChange={setDraft}
          bioRows={3}
          publicContactDescription="Optional. This is shown only when a client chooses to email you from the hire directory; your account email stays private."
        />
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
