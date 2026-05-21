import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getUser } from '../../lib/users'
import { listReviews, averageRating } from '../../lib/reviews'
import type { User, MowerReview } from '../../models'

export default function MowerPublicProfile() {
  const { mowerId } = useParams<{ mowerId: string }>()
  const [mower, setMower] = useState<User | null>(null)
  const [reviews, setReviews] = useState<MowerReview[]>([])
  const [rating, setRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mowerId) return
    let alive = true
    const run = async () => {
      try {
        const [m, rs, avg] = await Promise.all([
          getUser(mowerId),
          listReviews(mowerId),
          averageRating(mowerId),
        ])
        if (!alive) return
        setMower(m)
        setReviews(rs)
        setRating(avg)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [mowerId])

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (!mower) return <p className="text-sm text-[var(--muted)]">Mower not found.</p>

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        <div className="flex items-start gap-4">
          {mower.photoUrl ? (
            <img src={mower.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl text-[var(--accent)]">
              {(mower.name?.charAt(0) ?? '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="display-font text-2xl font-bold">{mower.name ?? 'Unnamed mower'}</h1>
            <p className="text-sm text-[var(--muted)]">
              {mower.mowerProfile?.suburb ?? mower.suburb ?? '—'}
            </p>
            {rating.count > 0 ? (
              <p className="mt-2 text-sm">
                <span className="text-[var(--accent)]">★ {rating.average.toFixed(1)}</span>{' '}
                <span className="text-[var(--muted)]">
                  · {rating.count} review{rating.count === 1 ? '' : 's'}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No reviews yet.</p>
            )}
            {mower.mowerProfile && (
              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
                {mower.mowerProfile.ratePerM2 != null && (
                  <>
                    <dt className="text-[var(--muted)]">Rate</dt>
                    <dd>${mower.mowerProfile.ratePerM2}/m²</dd>
                  </>
                )}
                <dt className="text-[var(--muted)]">Service radius</dt>
                <dd>{mower.mowerProfile.serviceRadiusKm} km</dd>
              </dl>
            )}
            {mower.mowerProfile?.bio && (
              <p className="mt-3 text-sm leading-relaxed">{mower.mowerProfile.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        <h2 className="display-font text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-l-2 border-[var(--accent)] pl-3">
                <p className="text-sm font-medium">
                  {'★'.repeat(r.rating)}
                  <span className="text-[var(--muted)]">{'★'.repeat(5 - r.rating)}</span>
                </p>
                {r.comment && <p className="mt-1 text-sm text-[var(--ink)]">{r.comment}</p>}
                <p className="mt-1 text-xs text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
