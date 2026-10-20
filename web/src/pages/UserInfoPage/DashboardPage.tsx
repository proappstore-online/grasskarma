import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getGroup } from '../../lib/streetGroups'
import { getUser, listGroupMembers } from '../../lib/users'
import { listSchedules, mowLabel } from '../../lib/schedules'
import { averageRating } from '../../lib/reviews'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { MowReminderBanner } from '../../components/MowReminderBanner'
import { ConfirmMow } from '../../components/ConfirmMow'
import { MOW_STATE_LABEL, mowState, type MowState } from '../../lib/mowRatings'

const MOW_STATE_PILL: Record<MowState, string> = {
  upcoming: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  due: 'bg-[var(--accent)] text-[var(--on-accent)]',
  'awaiting-confirmation': 'border border-[var(--accent)] text-[var(--accent)]',
  confirmed: 'bg-[var(--secondary-soft)] text-[var(--success)]',
  skipped: 'bg-[var(--accent-soft)] text-[var(--muted)]',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (user && !user.streetGroupId) {
      navigate('/app/setup', { replace: true })
    }
  }, [user, navigate])

  const { data, loading, error, reload } = useAsyncResource(async () => {
    const group = await getGroup(user!.streetGroupId!)
    if (!group) return { group: null, members: [], schedules: [], mower: null, mowerRating: null }
    const [members, schedules, mower] = await Promise.all([
      listGroupMembers(group.id),
      listSchedules(group.id),
      group.assignedMowerId ? getUser(group.assignedMowerId) : Promise.resolve(null),
    ])
    const mowerRating = mower ? await averageRating(mower.id) : null
    return { group, members, schedules, mower, mowerRating }
  }, [user?.streetGroupId], { enabled: Boolean(user?.streetGroupId) })

  const group = data?.group ?? null
  const members = data?.members ?? []
  const schedules = data?.schedules ?? []
  const mower = data?.mower ?? null
  const mowerRating = data?.mowerRating ?? null

  if (loading) {
    return <p role="status" className="text-sm text-[var(--muted)]">Loading…</p>
  }
  if (error) {
    return <p role="alert" className="text-sm text-[var(--error)]">Failed to load dashboard.</p>
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
        {isAdmin && <Link to="/app/manage" className="inline-flex min-h-11 items-center text-sm text-[var(--accent)] hover:underline">Manage group →</Link>}
      </header>

      <MowReminderBanner schedules={schedules} preferencesPath="/app/preferences" />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Your mower</h2>
          {mower ? (
            <div className="mt-3 space-y-2">
              <Link to={`/mower/${mower.id}`} className="flex min-h-11 items-center font-medium text-[var(--accent)] hover:underline">
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
              <Link to="/app/mowers" className="inline-flex min-h-11 items-center text-sm text-[var(--accent)] hover:underline">
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
            {schedules.map((s) => {
              const state = mowState(s)
              return (
                <li key={s.id} className="space-y-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>{mowLabel(s)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${MOW_STATE_PILL[state]}`}>{MOW_STATE_LABEL[state]}</span>
                  </div>
                  {s.status === 'done' && <ConfirmMow schedule={s} mowLabel={mowLabel(s)} onSaved={reload} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Members</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md border border-[var(--line)] p-3">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  {(m.name?.charAt(0) ?? '?').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link to={`/app/user/${m.id}`} className="block truncate text-sm leading-11 font-medium hover:underline">
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
