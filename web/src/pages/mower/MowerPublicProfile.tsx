import { useParams } from 'react-router-dom'
import { getUser } from '../../lib/users'
import { listReviews, averageRating } from '../../lib/reviews'
import { mowerContactHref } from '../../lib/mowerContacts'
import { useAsyncResource } from '../../hooks/useAsyncResource'

export default function MowerPublicProfile() {
  const { mowerId } = useParams<{ mowerId: string }>()
  const { data, loading, error } = useAsyncResource(async () => {
    const [mower, reviews, rating] = await Promise.all([
      getUser(mowerId!),
      listReviews(mowerId!),
      averageRating(mowerId!),
    ])
    return { mower, reviews, rating }
  }, [mowerId], { enabled: Boolean(mowerId) })
  // /mower/:mowerId also catches unknown /mower/* paths; only a mower row is a mower profile.
  const mower = data?.mower?.role === 'mower' ? data.mower : null
  const reviews = data?.reviews ?? []
  const rating = data?.rating ?? { average: 0, count: 0 }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">Failed to load mower profile.</p>
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
            {mower.publicContactEmail && (
              <a
                href={mowerContactHref(mower.publicContactEmail)}
                className="mt-4 inline-block rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Email mower
              </a>
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
