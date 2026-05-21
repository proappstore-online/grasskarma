import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getGroup } from '../../lib/streetGroups'
import { getUser } from '../../lib/users'
import { listSchedules } from '../../lib/schedules'
import { averageRating } from '../../lib/reviews'
import type { StreetGroup, Schedule, User } from '../../models'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [group, setGroup] = useState<StreetGroup | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [mower, setMower] = useState<User | null>(null)
  const [mowerRating, setMowerRating] = useState<{ average: number; count: number } | null>(null)

  useEffect(() => {
    if (!user) return
    if (!user.streetGroupId) {
      navigate('/app/setup', { replace: true })
      return
    }
    let alive = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const g = await getGroup(user.streetGroupId!)
        if (!alive) return
        setGroup(g)
        if (!g) {
          setLoading(false)
          return
        }
        const [ms, ss, mw] = await Promise.all([
          Promise.all(g.memberIds.map((id) => getUser(id))),
          listSchedules(g.id),
          g.assignedMowerId ? getUser(g.assignedMowerId) : Promise.resolve(null),
        ])
        if (!alive) return
        setMembers(ms.filter((m): m is User => !!m))
        setSchedules(ss)
        setMower(mw)
        if (mw) {
          const avg = await averageRating(mw.id)
          if (alive) setMowerRating(avg)
        }
      } catch (err) {
        console.error(err)
        if (alive) setError('Failed to load dashboard.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [user, navigate])

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>
  }
  if (error) {
    return <p className="text-sm text-[var(--error)]">{error}</p>
  }
  if (!group) {
    return <p className="text-sm text-[var(--muted)]">Group not found.</p>
  }

  const isAdmin = user && group.adminIds.includes(user.id)
  const next = schedules.find((s) => s.status === 'planned')

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="display-font text-3xl font-bold">
          {group.streetName ? `${group.streetName} ${group.suburb ?? ''}` : group.name}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {group.memberIds.length} member{group.memberIds.length === 1 ? '' : 's'}
          {isAdmin ? ' · You are an admin' : ''}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Your mower</h2>
          {mower ? (
            <div className="mt-3 space-y-2">
              <Link to={`/mower/${mower.id}`} className="block font-medium text-[var(--accent)] hover:underline">
                {mower.name ?? 'Unnamed mower'}
              </Link>
              {mowerRating && mowerRating.count > 0 && (
                <p className="text-sm text-[var(--muted)]">
                  {mowerRating.average.toFixed(1)} stars · {mowerRating.count} review
                  {mowerRating.count === 1 ? '' : 's'}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-[var(--muted)]">No mower assigned yet.</p>
              <Link to="/app/mowers" className="text-sm text-[var(--accent)] hover:underline">
                Browse interested mowers →
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Next mow</h2>
          {next ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-[var(--ink)]">
                {next.dueDate
                  ? new Date(next.dueDate).toLocaleDateString()
                  : next.dayOfWeek != null
                    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][next.dayOfWeek]
                    : 'Unscheduled'}
              </p>
              {next.startTime && <p className="text-[var(--muted)]">at {next.startTime}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No mow scheduled yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Schedule</h2>
        {schedules.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">No schedules yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {schedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {s.dueDate
                    ? new Date(s.dueDate).toLocaleDateString()
                    : s.dayOfWeek != null
                      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][s.dayOfWeek]
                      : '—'}
                  {s.startTime ? ` · ${s.startTime}` : ''}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.status === 'done'
                      ? 'bg-[var(--secondary-soft)] text-[var(--success)]'
                      : s.status === 'skipped'
                        ? 'bg-[var(--accent-soft)] text-[var(--muted)]'
                        : 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Members</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-[var(--line)] p-3">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name ?? ''} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  {(m.name?.charAt(0) ?? '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link to={`/app/user/${m.id}`} className="block truncate text-sm font-medium hover:underline">
                  {m.name ?? 'Unnamed'}
                </Link>
                <p className="truncate text-xs text-[var(--muted)]">
                  Joined {new Date(m.createdAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
