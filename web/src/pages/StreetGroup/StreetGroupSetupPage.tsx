import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listGroups, createGroup, addMember, createGroupInterest } from '../../lib/streetGroups'
import { updateUser } from '../../lib/users'
import type { StreetGroup } from '../../models'

// Simplified port — drops the AU state/city dropdown and the multi-step
// "fetch existing → maybe create" gating in favour of a single suburb +
// postcode lookup. Same end behaviour: if a group exists on the same street,
// the user requests to join; otherwise they create their own.
export default function StreetGroupSetupPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [suburb, setSuburb] = useState('')
  const [postcode, setPostcode] = useState('')
  const [streetName, setStreetName] = useState('')
  const [existing, setExisting] = useState<StreetGroup[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [requestedIds, setRequestedIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (user?.streetGroupId) {
      navigate('/app', { replace: true })
    }
  }, [user, navigate])

  const handleSearch = async () => {
    setError(null)
    if (!suburb.trim() || !/^\d{4}$/.test(postcode.trim())) {
      setError('Suburb and 4-digit postcode are required.')
      return
    }
    setBusy(true)
    try {
      const groups = await listGroups({ suburb: suburb.trim(), postcode: postcode.trim() })
      setExisting(groups)
      setSearched(true)
    } catch (err) {
      console.error(err)
      setError('Search failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (group: StreetGroup) => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await createGroupInterest(group.id, user.id, null)
      setRequestedIds((prev) => [...prev, group.id])
      setMessage(`Requested to join ${group.name}. The group admins will review your request.`)
    } catch (err) {
      console.error(err)
      setError('Failed to send request.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!user) return
    if (!streetName.trim()) {
      setError('Street name is required to create a group.')
      return
    }
    if (existing.some((g) => (g.streetName ?? '').toLowerCase() === streetName.trim().toLowerCase())) {
      setError('A group already exists on that street — please join it.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const name = `${streetName.trim()} ${postcode.trim()}`
      const g = await createGroup({
        name,
        streetName: streetName.trim(),
        suburb: suburb.trim(),
        postcode: postcode.trim(),
        country: 'AU',
        createdBy: user.id,
      })
      await addMember(g.id, user.id)
      await updateUser(user.id, { streetGroupId: g.id })
      await refresh()
      navigate('/app', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Failed to create group.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="display-font text-2xl font-bold">Set up your street group</h1>
      <p className="text-sm text-[var(--muted)]">
        Tell us where you live. We'll show any neighbours who've already started a group, or you can start one
        of your own.
      </p>

      <div className="space-y-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Suburb</label>
          <input
            type="text"
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Postcode</label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <button
          onClick={() => void handleSearch()}
          disabled={busy}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Searching…' : 'Find my group'}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {message && <p className="text-sm text-[var(--success)]">{message}</p>}

      {searched && (
        <div className="space-y-4">
          {existing.length > 0 ? (
            <div className="space-y-3">
              <h2 className="display-font text-lg font-semibold">Existing groups in your area</h2>
              {existing.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--glass)] p-4"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {g.streetName ?? '—'} · {g.memberIds.length} member
                      {g.memberIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleJoin(g)}
                    disabled={busy || requestedIds.includes(g.id)}
                    className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                  >
                    {requestedIds.includes(g.id) ? 'Requested' : 'Request to join'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No existing groups found. You can start one below.</p>
          )}

          <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
            <h2 className="display-font text-lg font-semibold">Create a new group</h2>
            <p className="text-xs text-[var(--muted)]">
              Each street can only have one group. If you see your street above, please join it instead.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Street name</label>
              <input
                type="text"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                placeholder="e.g. Collins"
                className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
