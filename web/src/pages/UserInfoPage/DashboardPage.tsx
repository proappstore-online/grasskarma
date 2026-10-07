import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getGroup } from '../../lib/streetGroups'
import { getUser } from '../../lib/users'
import { listSchedules } from '../../lib/schedules'
import { averageRating } from '../../lib/reviews'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import type { User } from '../../models'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (user && !user.streetGroupId) {
      navigate('/app/setup', { replace: true })
    }
  }, [user, navigate])

  const { data, loading, error } = useAsyncResource(async () => {
    const group = await getGroup(user!.streetGroupId!)
    if (!group) return { group: null, members: [], schedules: [], mower: null, mowerRating: null }
    const [members, schedules, mower] = await Promise.all([
      Promise.all(group.memberIds.map((id) => getUser(id))),
      listSchedules(group.id),
      group.assignedMowerId ? getUser(group.assignedMowerId) : Promise.resolve(null),
    ])
    const mowerRating = mower ? await averageRating(mower.id) : null
    return { group, members: members.filter((member): member is User => !!member), schedules, mower, mowerRating }
  }, [user?.streetGroupId], { enabled: Boolean(user?.streetGroupId) })

  const group = data?.group ?? null
  const members = data?.members ?? []
  const schedules = data?.schedules ?? []
  const mower = data?.mower ?? null
  const mowerRating = data?.mowerRating ?? null

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>
  }
  if (error) {
    return <p className="text-sm text-[var(--error)]">Failed to load dashboard.</p>
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
        {isAdmin && <Link to="/app/manage" className="inline-block text-sm text-[var(--accent)] hover:underline">Manage group →</Link>}
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
