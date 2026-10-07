import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { approveGroupInterest, deleteGroupInterest, getGroup, listGroupInterests } from '../../lib/streetGroups'
import { createSchedule, listSchedules, updateSchedule } from '../../lib/schedules'
import { getUser } from '../../lib/users'
import type { Schedule, StreetGroup, StreetGroupInterest, User } from '../../models'

type RequestCard = { interest: StreetGroupInterest; applicant: User | null }

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

  const load = async () => {
    if (!user?.streetGroupId) return
    setLoading(true)
    setError(null)
    try {
      const g = await getGroup(user.streetGroupId)
      if (!g) return
      const [pending, planned] = await Promise.all([listGroupInterests(g.id), listSchedules(g.id)])
      const applicants = await Promise.all(pending.map(async (interest) => ({ interest, applicant: await getUser(interest.userId) })))
      setGroup(g)
      setRequests(applicants)
      setSchedules(planned)
    } catch (err) {
      console.error(err)
      setError('Could not load the group management details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [user?.streetGroupId])

  const approve = async (request: RequestCard) => {
    if (!group) return
    setBusy(request.interest.id)
    setError(null)
    try {
      await approveGroupInterest(group.id, request.interest.id, request.interest.userId)
      setRequests((current) => current.filter((item) => item.interest.id !== request.interest.id))
      setNotice(`${request.applicant?.name ?? 'The applicant'} is now a member.`)
    } catch (err) {
      console.error(err)
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
      setRequests((current) => current.filter((item) => item.interest.id !== request.interest.id))
      setNotice('Join request declined.')
    } catch (err) {
      console.error(err)
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
      const schedule = await createSchedule({
        groupId: group.id,
        mowerId: group.assignedMowerId,
        dayOfWeek: dayOfWeek === '' ? null : Number(dayOfWeek),
        startTime: startTime || null,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
      })
      setSchedules((current) => [...current, schedule])
      setDayOfWeek('')
      setStartTime('')
      setDueDate('')
      setNotice('Schedule created and assigned to the selected mower.')
    } catch (err) {
      console.error(err)
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
      setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, status: 'skipped' } : item))
      setNotice('Schedule marked skipped.')
    } catch (err) {
      console.error(err)
      setError('Could not update that schedule.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (!group || !user || !group.adminIds.includes(user.id)) return <Navigate to="/app" replace />

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
