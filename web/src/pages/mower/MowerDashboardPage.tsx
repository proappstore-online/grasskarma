import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listGroupsForMower } from '../../lib/streetGroups'
import { listSchedulesForMower, mowLabel, type ScheduleCompletion } from '../../lib/schedules'
import { listHistory } from '../../lib/history'
import { averageRating } from '../../lib/reviews'
import { mowerCompletionLabel } from '../../lib/mowRatings'
import { MarkMowDone } from '../../components/MarkMowDone'
import { markMowDone } from '../../lib/mowCompletion'
import { ActionRefusedError } from '../../lib/actions'
import { MowReminderBanner } from '../../components/MowReminderBanner'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import type { Schedule, StreetGroup } from '../../models'

function isProfileComplete(m: { suburb?: string; postcode?: string; serviceRadiusKm?: number } | null | undefined) {
  return !!(m && m.suburb && m.postcode && typeof m.serviceRadiusKm === 'number' && m.serviceRadiusKm > 0)
}

/**
 * The schedule query is newest-due first; upcoming work is shown soonest first,
 * with undated jobs last.
 */
/** Finished work, newest due first (the query's order), for its confirmation state. */
export function recentCompletions(schedules: Schedule[]): Schedule[] {
  return schedules.filter((schedule) => schedule.status !== 'planned').slice(0, 5)
}

export function upcomingSchedules(schedules: Schedule[]): Schedule[] {
  return schedules
    .filter((schedule) => schedule.status === 'planned')
    .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
}

/**
 * The server authorizes completion by the schedule's own mower and group, so a
 * job stays completable even when its group is no longer assigned to the mower.
 */
export function completionForSchedule(schedule: Schedule, groups: StreetGroup[]): ScheduleCompletion {
  const group = groups.find((candidate) => candidate.id === schedule.groupId)
  return {
    scheduleId: schedule.id,
    groupId: schedule.groupId,
    streetName: group ? group.streetName ?? group.name : null,
  }
}

export default function MowerDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [completing, setCompleting] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [completionMessage, setCompletionMessage] = useState<string | null>(null)

  useEffect(() => {
    if (user && !isProfileComplete(user.mowerProfile)) {
      navigate('/mower/setup', { replace: true })
    }
  }, [user, navigate])

  const { data, loading, error, reload } = useAsyncResource(async () => {
    const [assigned, schedules, history, rating] = await Promise.all([
      listGroupsForMower(),
      listSchedulesForMower(),
      listHistory(user!.id, 10),
      averageRating(user!.id),
    ])
    return { assigned, upcoming: upcomingSchedules(schedules), recent: recentCompletions(schedules), history, rating }
  }, [user?.id, user?.mowerProfile], { enabled: Boolean(user && isProfileComplete(user.mowerProfile)) })
  const assigned = data?.assigned ?? []
  const upcoming = data?.upcoming ?? []
  const recent = data?.recent ?? []
  const history = data?.history ?? []
  const rating = data?.rating ?? null

  const complete = async (schedule: Schedule, photo: File | null) => {
    setCompleting(schedule.id)
    setCompletionError(null)
    setCompletionMessage(null)
    try {
      await markMowDone(completionForSchedule(schedule, assigned), photo)
      setCompletionMessage(`Marked done: ${mowLabel(schedule)}. Residents can now confirm it.`)
    } catch (err) {
      console.error(err)
      setCompletionError(err instanceof ActionRefusedError
        ? 'This mow could not be marked done: it may already be done or no longer assigned to you. The list was reloaded.'
        : 'Could not mark this mow as done. Please try again.')
    } finally {
      setCompleting(null)
      // Show the server's state, never an optimistic patch.
      await reload()
    }
  }


  if (loading) return <p role="status" className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-[var(--error)]">Failed to load dashboard.</p>

  return (
    <section className="space-y-6">
      <header>
        <h1 className="display-font text-3xl font-bold">Welcome, {user?.name?.split(' ')[0] ?? 'mower'}</h1>
        {rating && rating.count > 0 && (
          <p className="mt-1 text-sm text-[var(--muted)]">
            ★ {rating.average.toFixed(1)} · {rating.count} review{rating.count === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <MowReminderBanner
        schedules={upcoming}
        placeFor={(schedule) => {
          const group = assigned.find((g) => g.id === schedule.groupId)
          return group ? group.streetName ?? group.name : null
        }}
        preferencesPath="/mower/preferences"
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Stat label="Active streets" value={assigned.length} />
        <Stat label="Upcoming mows" value={upcoming.length} />
        <Stat label="Recent jobs" value={history.length} />
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Assigned streets</h2>
        {assigned.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            You're not assigned to any streets yet.{' '}
            <Link to="/mower/streets" className="text-[var(--accent)] hover:underline">
              Browse open streets
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {assigned.map((g) => (
              <li key={g.id} className="py-3">
                <p className="font-medium">{g.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {g.suburb ?? '—'} · {g.memberIds.length} member{g.memberIds.length === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Upcoming mows</h2>
        {completionError && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{completionError}</p>}
        {completionMessage && <p role="status" className="mt-2 text-sm text-[var(--success)]">{completionMessage}</p>}
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No scheduled jobs.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {upcoming.slice(0, 5).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>{mowLabel(s)}</span>
                <div className="flex items-center gap-3">
                  <Link to={`/mower/history`} className="inline-flex min-h-11 items-center text-xs text-[var(--accent)] hover:underline">History</Link>
                  <MarkMowDone mowLabel={mowLabel(s)} saving={completing === s.id} onConfirm={(photo) => void complete(s, photo)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Recent completions</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No completed mows yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>{mowLabel(s)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${s.confirmationCount > 0 ? 'bg-[var(--secondary-soft)] text-[var(--success)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                  {mowerCompletionLabel(s)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="display-font mt-1 text-3xl font-bold text-[var(--accent)]">{value}</p>
    </div>
  )
}
