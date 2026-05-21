import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listInterestsForGroup, voteTally, castVote, listVotes } from '../../lib/mowerInterests'
import { getUser } from '../../lib/users'
import type { MowerInterest, User } from '../../models'

interface Card {
  interest: MowerInterest
  mower: User
  tally: { up: number; down: number; score: number }
  myVote: -1 | 1 | null
}

export default function MowersPage() {
  const { user } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.streetGroupId) {
      setLoading(false)
      return
    }
    let alive = true
    const run = async () => {
      try {
        const interests = await listInterestsForGroup(user.streetGroupId!)
        const enriched = await Promise.all(
          interests.map(async (i) => {
            const [mower, tally, votes] = await Promise.all([
              getUser(i.mowerId),
              voteTally(i.id),
              listVotes(i.id),
            ])
            if (!mower) return null
            const my = votes.find((v) => v.voterId === user.id)
            return { interest: i, mower, tally, myVote: my?.vote ?? null } as Card
          }),
        )
        if (alive) setCards(enriched.filter((c): c is Card => !!c))
      } catch (err) {
        console.error(err)
        if (alive) setError('Failed to load mowers.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [user])

  const handleVote = async (interestId: string, vote: 1 | -1) => {
    if (!user) return
    setVoting(interestId)
    try {
      await castVote(interestId, user.id, vote)
      const tally = await voteTally(interestId)
      setCards((prev) => prev.map((c) => (c.interest.id === interestId ? { ...c, myVote: vote, tally } : c)))
    } catch (err) {
      console.error(err)
    } finally {
      setVoting(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>
  if (!user?.streetGroupId) {
    return (
      <section className="space-y-3">
        <h1 className="display-font text-2xl font-bold">Interested mowers</h1>
        <p className="text-sm text-[var(--muted)]">Join or create a street group to see interested mowers.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-font text-2xl font-bold">Interested mowers</h1>
        <p className="text-sm text-[var(--muted)]">
          Review mower profiles and vote for your preferred option.
        </p>
      </header>

      {cards.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No mowers have expressed interest yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map(({ interest, mower, tally, myVote }) => (
            <li key={interest.id} className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
              <div className="flex items-center gap-3">
                {mower.photoUrl ? (
                  <img src={mower.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    {(mower.name?.charAt(0) ?? '?').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{mower.name ?? 'Unnamed mower'}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {mower.mowerProfile?.suburb ?? mower.suburb ?? '—'}
                  </p>
                </div>
              </div>

              {interest.message && (
                <p className="mt-3 text-sm text-[var(--ink)]">"{interest.message}"</p>
              )}

              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-[var(--muted)]">Rate</dt>
                <dd>{mower.mowerProfile?.ratePerM2 ? `$${mower.mowerProfile.ratePerM2}/m²` : '—'}</dd>
                <dt className="text-[var(--muted)]">Service radius</dt>
                <dd>{mower.mowerProfile?.serviceRadiusKm ? `${mower.mowerProfile.serviceRadiusKm} km` : '—'}</dd>
              </dl>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">
                  Score: <strong className="text-[var(--ink)]">{tally.score}</strong> ({tally.up}↑ {tally.down}↓)
                </span>
                <div className="flex gap-2">
                  <Link
                    to={`/mower/${mower.id}`}
                    className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => void handleVote(interest.id, 1)}
                    disabled={voting === interest.id}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      myVote === 1
                        ? 'bg-[var(--secondary)] text-white'
                        : 'border border-[var(--secondary)] text-[var(--secondary)] hover:bg-[var(--secondary-soft)]'
                    } disabled:opacity-50`}
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() => void handleVote(interest.id, -1)}
                    disabled={voting === interest.id}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      myVote === -1
                        ? 'bg-[var(--error)] text-white'
                        : 'border border-[var(--error)] text-[var(--error)] hover:bg-[var(--paper)]'
                    } disabled:opacity-50`}
                  >
                    ↓ Down
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
