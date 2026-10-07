import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { approveGroupInterest, deleteGroupInterest, getGroup, listGroupInterests } from '../../lib/streetGroups'
import { createSchedule, listSchedules, updateSchedule } from '../../lib/schedules'
import { getUser } from '../../lib/users'
import type { Schedule, StreetGroup, StreetGroupInterest, User } from '../../models'

type RequestCard = { interest: StreetGroupInterest; applicant: User | null }

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type GroupManagementView = 'loading' | 'setup' | 'app' | 'content'

// Kept separate from the component so every route outcome is explicit and
// testable. In particular, a fully-loaded client without a group belongs in
// setup, rather than on a page that can only render a perpetual loader.
export function resolveGroupManagementView({
  hasProfile,
  loading,
  streetGroupId,
  group,
  userId,
}: {
  hasProfile: boolean
  loading: boolean
  streetGroupId: string | null | undefined
  group: StreetGroup | null
  userId: string | null | undefined
}): GroupManagementView {
  if (!hasProfile || loading) return 'loading'
  if (!streetGroupId) return 'setup'
  if (!group || !userId || !group.adminIds.includes(userId)) return 'app'
  return 'content'
}

export function shouldCommitGroupManagementLoad({
  requestGeneration,
  activeGeneration,
  mounted,
}: {
  requestGeneration: number
  activeGeneration: number
  mounted: boolean
}): boolean {
  return mounted && requestGeneration === activeGeneration
}

export default function GroupManagementPage() {
  const { user } = useAuth()
  const [group, setGroup] = useState<StreetGroup | null>(null)
  const [requests, setRequests] = useState<RequestCard[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState('')
  const [startTime, setStartTime] = useState('')
  const [dueDate, setDueDate] = useState('')
  const mounted = useRef(false)
  const loadGeneration = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      loadGeneration.current += 1
    }
  }, [])

  const load = useCallback(async () => {
    const streetGroupId = user?.streetGroupId
    const requestGeneration = ++loadGeneration.current
    const canCommit = () => shouldCommitGroupManagementLoad({
      requestGeneration,
      activeGeneration: loadGeneration.current,
      mounted: mounted.current,
    })

    // AuthGate normally means this page is not mounted until a profile exists.
    // Retaining the loading state here also avoids redirecting during a delayed
    // profile response when the page is rendered in isolation.
    if (!user) return
    if (!streetGroupId) {
      if (canCommit()) {
        setGroup(null)
        setRequests([])
        setSchedules([])
        setError(null)
        setLoading(false)
      }
      return
    }

    if (canCommit()) {
      setLoading(true)
      setError(null)
    }
    try {
      const g = await getGroup(streetGroupId)
      if (!canCommit()) return
      if (!g) {
        setGroup(null)
        setRequests([])
        setSchedules([])
        return
      }
      const [pending, planned] = await Promise.all([listGroupInterests(g.id), listSchedules(g.id)])
      const applicants = await Promise.all(pending.map(async (interest) => ({ interest, applicant: await getUser(interest.userId) })))
      if (!canCommit()) return
      setGroup(g)
      setRequests(applicants)
      setSchedules(planned)
    } catch (err) {
      console.error(err)
      if (canCommit()) setError('Could not load the group management details.')
    } finally {
      if (canCommit()) setLoading(false)
    }
  }, [user?.streetGroupId, user])

  useEffect(() => { void load() }, [load])

  const approve = async (request: RequestCard) => {
    if (!group) return
    setBusy(request.interest.id)
    setError(null)
    try {
      await approveGroupInterest(group.id, request.interest.id, request.interest.userId)
      await load()
      setNotice(`${request.applicant?.name ?? 'The applicant'} is now a member.`)
    } catch (err) {
      console.error(err)
      await load()
      setError('Could not approve that request. Nothing was changed.')
    } finally {
      setBusy(null)
    }
  }

  const reject = async (request: RequestCard) => {
    setBusy(request.interest.id)
    setError(null)
    try {
      await deleteGroupInterest(request.interest.id)
      await load()
      setNotice('Join request declined.')
    } catch (err) {
      console.error(err)
      await load()
      setError('Could not decline that request.')
    } finally {
      setBusy(null)
    }
  }

  const addSchedule = async (event: FormEvent) => {
    event.preventDefault()
    if (!group) return
    setBusy('schedule')
    setError(null)
    try {
      await createSchedule({
        groupId: group.id,
        mowerId: group.assignedMowerId,
        dayOfWeek: dayOfWeek === '' ? null : Number(dayOfWeek),
        startTime: startTime || null,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
      })
      await load()
      setDayOfWeek('')
      setStartTime('')
      setDueDate('')
      setNotice('Schedule created and assigned to the selected mower.')
    } catch (err) {
      console.error(err)
      await load()
      setError('Could not create the schedule. Check the date, day and time.')
    } finally {
      setBusy(null)
    }
  }

  const skip = async (schedule: Schedule) => {
    setBusy(schedule.id)
    setError(null)
    try {
      await updateSchedule(schedule.id, { status: 'skipped' })
      await load()
      setNotice('Schedule marked skipped.')
    } catch (err) {
      console.error(err)
      await load()
      setError('Could not update that schedule.')
    } finally {
      setBusy(null)
    }
  }

  const view = resolveGroupManagementView({
    hasProfile: !!user,
    loading,
    streetGroupId: user?.streetGroupId,
    group,
    userId: user?.id,
  })

  if (view === 'loading') return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (view === 'setup') return <Navigate to="/app/setup" replace />
  if (view === 'app') return <Navigate to="/app" replace />
  // `content` means both values are present. Keep this guard for TypeScript
  // and for a defensive fallback if a future view state is added.
  if (!group || !user) return <Navigate to="/app" replace />

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="display-font text-2xl font-bold">Manage {group.name}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Review neighbours, set the mowing cadence and manage scheduled work.</p>
      </header>
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {notice && <p className="text-sm text-[var(--success)]">{notice}</p>}

      <section className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Join requests</h2>
        {requests.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No pending requests.</p> : (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {requests.map((request) => (
              <li key={request.interest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{request.applicant?.name ?? 'Neighbour'}</p>{request.interest.message && <p className="text-sm text-[var(--muted)]">{request.interest.message}</p>}</div>
                <div className="flex gap-2"><button onClick={() => void approve(request)} disabled={busy === request.interest.id} className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Approve</button><button onClick={() => void reject(request)} disabled={busy === request.interest.id} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm disabled:opacity-50">Decline</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Create a mow schedule</h2>
        {!group.assignedMowerId ? <p className="mt-2 text-sm text-[var(--muted)]">Choose a mower on the Mowers page before scheduling work.</p> : (
          <form onSubmit={(event) => void addSchedule(event)} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">Recurring day<select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)} className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2"><option value="">One-off</option>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label className="text-sm">Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2" /></label>
            <label className="text-sm">Due date<input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 block w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2" /></label>
            <button disabled={busy === 'schedule'} className="sm:col-span-3 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy === 'schedule' ? 'Creating…' : 'Create schedule'}</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Scheduled work</h2>
        {schedules.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No schedules yet.</p> : <ul className="mt-3 divide-y divide-[var(--line)]">{schedules.map((schedule) => <li key={schedule.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{schedule.dueDate ? new Date(schedule.dueDate).toLocaleString() : schedule.dayOfWeek != null ? dayNames[schedule.dayOfWeek] : 'Unscheduled'}{schedule.startTime ? ` · ${schedule.startTime}` : ''} · {schedule.status}</span>{schedule.status === 'planned' && <button onClick={() => void skip(schedule)} disabled={busy === schedule.id} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs disabled:opacity-50">Mark skipped</button>}</li>)}</ul>}
      </section>
    </section>
  )
}
