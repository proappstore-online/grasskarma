import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LabeledField, LabeledTextArea, MowerProfileFields } from '../../components/MowerProfileFields'
import { useAuth } from '../../contexts/AuthContext'
import { getUser, updateUser } from '../../lib/users'
import { replaceAvatar } from '../../lib/photos'
import { createMowerProfileDraft, serializeMowerProfileDraft } from '../../lib/mowerProfileForm'
import type { User, ClientProfile } from '../../models'

export default function UserProfileEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: me, refresh } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Editable fields
  const [name, setName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [postcode, setPostcode] = useState('')
  const [state, setStateField] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [clientProfile, setClientProfile] = useState<ClientProfile>({})
  const [mowerProfileDraft, setMowerProfileDraft] = useState(() => createMowerProfileDraft(null, null, 'edit'))

  useEffect(() => {
    if (!userId) {
      setError('User ID is missing.')
      setLoading(false)
      return
    }
    if (me && me.id !== userId) {
      setError('You can only edit your own profile.')
      setLoading(false)
      return
    }
    let alive = true
    const run = async () => {
      try {
        const u = await getUser(userId)
        if (!alive) return
        if (!u) {
          setError('User not found.')
          return
        }
        setUser(u)
        setName(u.name ?? '')
        setSuburb(u.suburb ?? '')
        setPostcode(u.postcode ?? '')
        setStateField(u.state ?? '')
        setPhotoUrl(u.photoUrl)
        setClientProfile(u.clientProfile ?? {})
        setMowerProfileDraft(createMowerProfileDraft(u.mowerProfile, u.publicContactEmail, 'edit'))
      } catch (err) {
        console.error(err)
        if (alive) setError('Failed to load profile.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [userId, me])

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setError(null)
    try {
      // replaceAvatar persists the new URL before it queues the previous
      // object for deletion, so a failed save can never remove the live image.
      const url = await replaceAvatar(photoUrl, file)
      setPhotoUrl(url)
    } catch (err) {
      console.error(err)
      setError('Avatar upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const mowerProfile = user.role === 'mower' ? serializeMowerProfileDraft(mowerProfileDraft) : null
      await updateUser({
        name: name.trim() || null,
        suburb: suburb.trim() || null,
        postcode: postcode.trim() || null,
        state: state.trim() || null,
        photoUrl,
        publicContactEmail: mowerProfile?.publicContactEmail,
        clientProfile: user.role === 'client' ? clientProfile : undefined,
        mowerProfile: mowerProfile?.mowerProfile,
      })
      await refresh()
      setMessage('Saved.')
      const base = user.role === 'mower' ? '/mower' : '/app'
      setTimeout(() => navigate(`${base}/user/${user.id}`), 800)
    } catch (err) {
      console.error(err)
      setError('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error && !user) return <p className="text-sm text-[var(--error)]">{error}</p>
  if (!user) return null

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="display-font text-2xl font-bold">Edit profile</h1>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Profile picture</h2>
        <div className="mt-4 flex items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl text-[var(--accent)]">
              {(name?.charAt(0) ?? '?').toUpperCase()}
            </div>
          )}
          <label className="cursor-pointer rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]">
            {uploading ? 'Uploading…' : 'Change picture'}
            <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Basics</h2>
        <LabeledField label="Name" value={name} onChange={setName} />
        <LabeledField label="Suburb" value={suburb} onChange={setSuburb} />
        <LabeledField label="Postcode" value={postcode} onChange={setPostcode} />
        <LabeledField label="State" value={state} onChange={setStateField} />
      </div>

      {user.role === 'client' && (
        <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Client profile</h2>
          <LabeledField
            label="Street"
            value={clientProfile.street ?? ''}
            onChange={(v) => setClientProfile({ ...clientProfile, street: v || undefined })}
          />
          <LabeledField
            label="Address number"
            value={clientProfile.addressNumber ?? ''}
            onChange={(v) => setClientProfile({ ...clientProfile, addressNumber: v || undefined })}
          />
          <LabeledField
            label="Lawn area (m²)"
            type="number"
            value={clientProfile.lawnAreaM2?.toString() ?? ''}
            onChange={(v) => setClientProfile({ ...clientProfile, lawnAreaM2: v ? Number(v) : undefined })}
          />
          <LabeledTextArea
            label="Bio"
            value={clientProfile.bio ?? ''}
            onChange={(v) => setClientProfile({ ...clientProfile, bio: v || undefined })}
          />
        </div>
      )}

      {user.role === 'mower' && (
        <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Mower profile</h2>
          <MowerProfileFields
            draft={mowerProfileDraft}
            onChange={setMowerProfileDraft}
            publicContactDescription="Optional. Clients can use this address from the hire directory; your account email is never shared."
          />
        </div>
      )}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      <div className="flex justify-between">
        <button
          onClick={() => navigate(-1)}
          disabled={saving}
          className="rounded-md border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--accent-soft)]"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  )
}
