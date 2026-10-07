import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listGroups } from '../../lib/streetGroups'
import { completeSchedule, listSchedulesForMower } from '../../lib/schedules'
import { listHistory } from '../../lib/history'
import { averageRating } from '../../lib/reviews'
import type { StreetGroup, Schedule, HistoryRecord } from '../../models'

function isProfileComplete(m: { suburb?: string; postcode?: string; serviceRadiusKm?: number } | null | undefined) {
  return !!(m && m.suburb && m.postcode && typeof m.serviceRadiusKm === 'number' && m.serviceRadiusKm > 0)
}

export default function MowerDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<StreetGroup[]>([])
  const [upcoming, setUpcoming] = useState<Schedule[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (!isProfileComplete(user.mowerProfile)) {
      navigate('/mower/setup', { replace: true })
      return
    }
    let alive = true
    const run = async () => {
      try {
        const [groups, schedules, hist, avg] = await Promise.all([
          listGroups({ mowerId: user.id }),
          listSchedulesForMower(20),
          listHistory(user.id, 10),
          averageRating(user.id),
        ])
        if (!alive) return
        setAssigned(groups)
        setUpcoming(schedules.filter((s) => s.status === 'planned'))
        setHistory(hist)
        setRating(avg)
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

  const complete = async (schedule: Schedule) => {
    const group = assigned.find((candidate) => candidate.id === schedule.groupId)
    if (!group) return
    setCompleting(schedule.id)
    setCompletionError(null)
    try {
      await completeSchedule({
        scheduleId: schedule.id,
        groupId: group.id,
        streetName: group.streetName ?? group.name,
      })
      const refreshedHistory = await listHistory(user!.id, 10)
      setHistory(refreshedHistory)
      setUpcoming((current) => current.filter((item) => item.id !== schedule.id))
    } catch (err) {
      console.error(err)
      setCompletionError('Could not complete this job. No history record was added.')
    } finally {
      setCompleting(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>

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
        {completionError && <p className="mt-2 text-sm text-[var(--error)]">{completionError}</p>}
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No scheduled jobs.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {upcoming.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '—'}
                  {s.startTime ? ` · ${s.startTime}` : ''}
                </span>
                <div className="flex items-center gap-3">
                  <Link to={`/mower/history`} className="text-xs text-[var(--accent)] hover:underline">History</Link>
                  <button onClick={() => void complete(s)} disabled={completing === s.id} className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
                    {completing === s.id ? 'Completing…' : 'Mark complete'}
                  </button>
                </div>
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
