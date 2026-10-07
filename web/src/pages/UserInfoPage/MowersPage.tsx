import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listInterestsForGroup, voteTally, castVote, listVotes } from '../../lib/mowerInterests'
import { getGroup, updateGroup } from '../../lib/streetGroups'
import { getUser } from '../../lib/users'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import type { MowerInterest, User } from '../../models'

interface Card {
  interest: MowerInterest
  mower: User
  tally: { up: number; down: number; score: number }
  myVote: -1 | 1 | null
}

export default function MowersPage() {
  const { user } = useAuth()
  const [voting, setVoting] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const { data, loading, error: loadError, updateData } = useAsyncResource(async () => {
    const [interests, group] = await Promise.all([listInterestsForGroup(user!.streetGroupId!), getGroup(user!.streetGroupId!)])
    const cards = await Promise.all(interests.map(async (interest) => {
      const [mower, tally, votes] = await Promise.all([getUser(interest.mowerId), voteTally(interest.id), listVotes(interest.id)])
      if (!mower) return null
      const myVote = votes.find((vote) => vote.voterId === user!.id)?.vote ?? null
      return { interest, mower, tally, myVote } as Card
    }))
    return {
      cards: cards.filter((card): card is Card => !!card),
      assignedMowerId: group?.assignedMowerId ?? null,
      isAdmin: Boolean(group?.adminIds.includes(user!.id)),
    }
  }, [user?.id, user?.streetGroupId], { enabled: Boolean(user?.streetGroupId) })
  const cards = data?.cards ?? []
  const assignedMowerId = data?.assignedMowerId ?? null
  const isAdmin = data?.isAdmin ?? false

  const handleVote = async (interestId: string, vote: 1 | -1) => {
    if (!user) return
    setVoting(interestId)
    try {
      await castVote(interestId, vote)
      const tally = await voteTally(interestId)
      updateData((current) => current && {
        ...current,
        cards: current.cards.map((card) => card.interest.id === interestId ? { ...card, myVote: vote, tally } : card),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setVoting(null)
    }
  }

  const handleAssign = async (mowerId: string) => {
    if (!user?.streetGroupId) return
    setVoting(`assign:${mowerId}`)
    setActionError(null)
    try {
      await updateGroup(user.streetGroupId, { assignedMowerId: mowerId })
      const group = await getGroup(user.streetGroupId)
      updateData((current) => current && {
        ...current,
        assignedMowerId: group?.assignedMowerId ?? null,
        isAdmin: Boolean(group?.adminIds.includes(user.id)),
      })
    } catch (err) {
      console.error(err)
      const group = await getGroup(user.streetGroupId).catch(() => null)
      updateData((current) => current && {
        ...current,
        assignedMowerId: group?.assignedMowerId ?? null,
        isAdmin: Boolean(group?.adminIds.includes(user.id)),
      })
      setActionError('Could not assign that mower.')
    } finally {
      setVoting(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (loadError || actionError) return <p className="text-sm text-[var(--error)]">{actionError ?? 'Failed to load mowers.'}</p>
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
              {isAdmin && (
                <button
                  onClick={() => void handleAssign(mower.id)}
                  disabled={voting === `assign:${mower.id}` || assignedMowerId === mower.id}
                  className={`mt-3 w-full rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                    assignedMowerId === mower.id ? 'bg-[var(--secondary-soft)] text-[var(--success)]' : 'bg-[var(--accent)] text-white hover:opacity-90'
                  }`}
                >
                  {assignedMowerId === mower.id ? 'Assigned mower' : voting === `assign:${mower.id}` ? 'Assigning…' : 'Assign this mower'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
