import { useEffect, useState } from 'react'

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
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
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
    </section>
  )
}
