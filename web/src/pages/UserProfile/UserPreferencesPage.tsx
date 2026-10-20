import { useEffect, useState } from 'react'
import { useAsyncResource } from '../../hooks/useAsyncResource'
import { getReminderOptOut, setReminderOptOut } from '../../lib/reminders'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'grasskarma:theme'

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export default function UserPreferencesPage() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="display-font text-2xl font-bold">Preferences</h1>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Theme</p>
        <div className="mt-3 flex gap-3">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <label key={t} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="theme"
                value={t}
                checked={theme === t}
                onChange={() => setTheme(t)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="capitalize">{t}</span>
            </label>
          ))}
          <button
            onClick={() => setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')}
            className="ml-2 text-sm text-[var(--accent)] hover:underline"
          >
            Use system
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Notifications</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Notifications are not yet wired up on the platform. Coming soon.
        </p>
      </div>
      <ReminderSetting />
    </section>
  )
}

/** Per-user opt-out for in-app mow reminders (#29). */
function ReminderSetting() {
  const optOut = useAsyncResource(getReminderOptOut, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const change = async (remindersOn: boolean) => {
    setSaving(true)
    setError(null)
    try {
      await setReminderOptOut(!remindersOn)
    } catch (err) {
      console.error(err)
      setError('Could not save your reminder setting. It was reloaded.')
    } finally {
      setSaving(false)
      await optOut.reload()
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
      <h2 className="display-font text-lg font-semibold">Reminders</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        A reminder appears on your dashboard when a mow is booked for today or tomorrow.
      </p>
      {optOut.loading && optOut.data === null ? (
        <p role="status" className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
      ) : optOut.error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--error)]">Could not load your reminder setting.</p>
      ) : (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={optOut.data === false}
            disabled={saving || optOut.loading}
            onChange={(event) => void change(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Show mow reminders
        </label>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[var(--error)]">{error}</p>}
    </div>
  )
}
