import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listUsers } from '../../lib/users'
import { getPublicMowerContact, mowerContactHref } from '../../lib/mowerContacts'
import { useAsyncResource } from '../../hooks/useAsyncResource'

// Browse mowers, see rates / service radius, send an email contact.
// All payment/booking flow is stripped per port plan §11 (Stripe-out).
export default function ShareHirePage() {
  const { user } = useAuth()
  const [contactError, setContactError] = useState<string | null>(null)
  const [contacting, setContacting] = useState<string | null>(null)
  const { data, loading, error } = useAsyncResource(
    () => listUsers({ role: 'mower' }),
    [],
  )
  const mowers = data ?? []

  const handleContact = async (mowerId: string) => {
    setContacting(mowerId)
    setContactError(null)
    try {
      const email = await getPublicMowerContact(mowerId)
      if (!email) throw new Error('This mower has not provided a public contact email.')
      window.location.assign(mowerContactHref(email))
    } catch (err) {
      console.error(err)
      setContactError(err instanceof Error ? err.message : 'Could not open mower contact details.')
    } finally {
      setContacting(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">Failed to load mowers.</p>

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-font text-2xl font-bold">Share / hire a mower</h1>
        <p className="text-sm text-[var(--muted)]">
          Browse mowers, see their rate and service area, and reach out directly.
        </p>
      </header>

      {contactError && <p className="text-sm text-[var(--error)]">{contactError}</p>}

      {mowers.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No mowers signed up yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {mowers.map((m) => (
            <li key={m.id} className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
              <div className="flex items-center gap-3">
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name ?? ''} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {(m.name?.charAt(0) ?? '?').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <Link to={`/mower/${m.id}`} className="block truncate font-medium hover:underline">
                    {m.name ?? 'Unnamed mower'}
                  </Link>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {m.mowerProfile?.suburb ?? m.suburb ?? '—'}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-[var(--muted)]">Rate</dt>
                <dd className="text-[var(--ink)]">
                  {m.mowerProfile?.ratePerM2 ? `$${m.mowerProfile.ratePerM2}/m²` : '—'}
                </dd>
                <dt className="text-[var(--muted)]">Service radius</dt>
                <dd className="text-[var(--ink)]">
                  {m.mowerProfile?.serviceRadiusKm ? `${m.mowerProfile.serviceRadiusKm} km` : '—'}
                </dd>
              </dl>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => void handleContact(m.id)}
                  disabled={contacting === m.id}
                  className="flex-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-center text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {contacting === m.id ? 'Opening…' : 'Email'}
                </button>
                <Link
                  to={user?.role === 'mower' ? `/mower/${m.id}` : `/app/user/${m.id}`}
                  className="flex-1 rounded-md border border-[var(--accent)] px-3 py-1.5 text-center text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  View profile
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
