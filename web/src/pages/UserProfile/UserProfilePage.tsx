import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getUser } from '../../lib/users'
import { averageRating } from '../../lib/reviews'
import type { User } from '../../models'

// Authenticated user-profile view (both client and mower share this).
// Public mower view at /mower/:mowerId is a separate page.
export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null)

  useEffect(() => {
    if (!userId) {
      setError('User ID is missing.')
      setLoading(false)
      return
    }
    let alive = true
    const run = async () => {
      try {
        const u = await getUser(userId)
        if (!alive) return
        setUser(u)
        if (u?.role === 'mower') {
          const avg = await averageRating(u.id)
          if (alive) setRating(avg)
        }
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
  }, [userId])

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>
  if (!user) return <p className="text-sm text-[var(--muted)]">User not found.</p>

  const isMe = me?.id === user.id
  const baseEdit = me?.role === 'mower' ? '/mower' : '/app'

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        <div className="flex items-start gap-4">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-semibold text-[var(--accent)]">
              {(user.name?.charAt(0) ?? '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="display-font truncate text-2xl font-bold">{user.name ?? 'Unnamed'}</h1>
            {user.email && <p className="text-sm text-[var(--muted)]">{user.email}</p>}
            <p className="mt-1 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
              {user.role}
            </p>
            {rating && rating.count > 0 && (
              <p className="mt-2 text-sm text-[var(--ink)]">
                ★ {rating.average.toFixed(1)} from {rating.count} review{rating.count === 1 ? '' : 's'}
              </p>
            )}
          </div>
          {isMe && (
            <button
              onClick={() => navigate(`${baseEdit}/user/${user.id}/edit`)}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {(user.suburb || user.postcode) && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Location</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            {user.suburb && (
              <>
                <dt className="text-[var(--muted)]">Suburb</dt>
                <dd>{user.suburb}</dd>
              </>
            )}
            {user.postcode && (
              <>
                <dt className="text-[var(--muted)]">Postcode</dt>
                <dd>{user.postcode}</dd>
              </>
            )}
            {user.state && (
              <>
                <dt className="text-[var(--muted)]">State</dt>
                <dd>{user.state}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {user.role === 'client' && user.clientProfile && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Client profile</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            {user.clientProfile.street && (
              <>
                <dt className="text-[var(--muted)]">Street</dt>
                <dd>{user.clientProfile.street}</dd>
              </>
            )}
            {user.clientProfile.lawnAreaM2 != null && (
              <>
                <dt className="text-[var(--muted)]">Lawn area</dt>
                <dd>{user.clientProfile.lawnAreaM2} m²</dd>
              </>
            )}
            {user.clientProfile.bio && (
              <>
                <dt className="col-span-2 mt-2 text-[var(--muted)]">Bio</dt>
                <dd className="col-span-2 text-[var(--ink)]">{user.clientProfile.bio}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {user.role === 'mower' && user.mowerProfile && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Mower profile</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            {user.mowerProfile.suburb && (
              <>
                <dt className="text-[var(--muted)]">Suburb</dt>
                <dd>{user.mowerProfile.suburb}</dd>
              </>
            )}
            {user.mowerProfile.postcode && (
              <>
                <dt className="text-[var(--muted)]">Postcode</dt>
                <dd>{user.mowerProfile.postcode}</dd>
              </>
            )}
            <dt className="text-[var(--muted)]">Service radius</dt>
            <dd>{user.mowerProfile.serviceRadiusKm} km</dd>
            {user.mowerProfile.ratePerM2 != null && (
              <>
                <dt className="text-[var(--muted)]">Rate</dt>
                <dd>${user.mowerProfile.ratePerM2}/m²</dd>
              </>
            )}
            {user.mowerProfile.bio && (
              <>
                <dt className="col-span-2 mt-2 text-[var(--muted)]">Bio</dt>
                <dd className="col-span-2 text-[var(--ink)]">{user.mowerProfile.bio}</dd>
              </>
            )}
          </dl>
          {!isMe && (
            <Link
              to={`/mower/${user.id}`}
              className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
            >
              View public mower profile + reviews →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
