import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { getReminderOptOut, setReminderOptOut, upcomingMowReminders, type MowReminder } from '../lib/reminders'
import type { Schedule } from '../models'

interface MowReminderBannerProps {
  schedules: Schedule[]
  /** Where the mow is, e.g. the street name; omitted when there is only one. */
  placeFor?: (schedule: Schedule) => string | null
  /** Path of the Preferences page, where reminders can be turned back on. */
  preferencesPath: string
}

export function describeReminder({ schedule, day }: MowReminder, place: string | null): string {
  const when = day === 'today' ? 'today' : 'tomorrow'
  const time = schedule.startTime ? ` at ${schedule.startTime}` : ''
  return `Mow ${when}${time}${place ? ` · ${place}` : ''}`
}

/** Dashboard banner for planned mows due today or tomorrow (#29). */
export function MowReminderBanner({ schedules, placeFor, preferencesPath }: MowReminderBannerProps) {
  const reminders = upcomingMowReminders(schedules)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const optOut = useAsyncResource(getReminderOptOut, [], { enabled: reminders.length > 0 })

  // Hidden while the preference loads, when it fails to load, and once the
  // user has opted out: a reminder must never show to someone who said no.
  if (reminders.length === 0 || optOut.loading || optOut.error || optOut.data !== false) return null

  const turnOff = async () => {
    setSaving(true)
    setError(null)
    try {
      await setReminderOptOut(true)
    } catch (err) {
      console.error(err)
      setError('Could not turn off reminders. Please try again.')
    } finally {
      setSaving(false)
      // Show the server's answer, not an optimistic guess.
      await optOut.reload()
    }
  }

  return (
    <section aria-labelledby="mow-reminders-heading" className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-4">
      <h2 id="mow-reminders-heading" className="text-sm font-semibold text-[var(--accent)]">Mow reminder</h2>
      <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
        {reminders.map((reminder) => (
          <li key={reminder.schedule.id}>{describeReminder(reminder, placeFor?.(reminder.schedule) ?? null)}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void turnOff()}
          disabled={saving}
          className="rounded-md border border-[var(--accent)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--accent)] disabled:opacity-50"
        >
          {saving ? 'Turning off…' : 'Turn off reminders'}
        </button>
        <Link to={preferencesPath} className="inline-flex min-h-11 items-center text-sm text-[var(--accent)] hover:underline">
          Reminder settings
        </Link>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{error}</p>}
    </section>
  )
}
