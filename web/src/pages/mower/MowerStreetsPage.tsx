import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { listGroups } from '../../lib/streetGroups'
import { listInterestsForMower, createMowerInterest } from '../../lib/mowerInterests'
import type { StreetGroup } from '../../models'

export default function MowerStreetsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<StreetGroup[]>([])
  const [interestedIds, setInterestedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    const run = async () => {
      try {
        const [allGroups, mine] = await Promise.all([
          listGroups({ status: 'forming' }),
          listInterestsForMower(user.id),
        ])
        if (!alive) return
        setGroups(allGroups)
        setInterestedIds(new Set(mine.map((i) => i.groupId)))
      } catch (err) {
        console.error(err)
        if (alive) setError('Failed to load streets.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [user])

  const handleExpressInterest = async (groupId: string) => {
    if (!user) return
    setSavingId(groupId)
    try {
      await createMowerInterest(groupId, user.id)
      setInterestedIds((prev) => new Set([...prev, groupId]))
    } catch (err) {
      console.error(err)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="display-font text-2xl font-bold">Open streets</h1>
        <p className="text-sm text-[var(--muted)]">
          Browse street groups looking for a mower and register your interest.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No open streets right now.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const isInterested = interestedIds.has(g.id)
            return (
              <li key={g.id} className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
                <h2 className="font-medium">{g.name}</h2>
                <p className="text-sm text-[var(--muted)]">
                  {g.suburb} {g.postcode}
                </p>
                <dl className="mt-3 space-y-1 text-sm">
                  {g.streetName && (
                    <div className="flex justify-between">
                      <dt className="text-[var(--muted)]">Street</dt>
                      <dd>{g.streetName}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted)]">Members</dt>
                    <dd>{g.memberIds.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted)]">Status</dt>
                    <dd className="capitalize">{g.status}</dd>
                  </div>
                </dl>
                <button
                  onClick={() => void handleExpressInterest(g.id)}
                  disabled={isInterested || savingId === g.id}
                  className={`mt-4 w-full rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isInterested
                      ? 'border border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--accent)] text-white hover:opacity-90'
                  } disabled:opacity-60`}
                >
                  {isInterested ? 'Interested' : savingId === g.id ? 'Saving…' : 'Express interest'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
