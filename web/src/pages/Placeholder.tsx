import { useLocation } from 'react-router-dom'

// Temporary stub used by every route until the real page is ported from
// grasskarma/site. Step 8 (client pages), Step 9 (mower pages), Step 12
// (admin pages) replace these one by one.
export function Placeholder({ title }: { title: string }) {
  const { pathname } = useLocation()
  return (
    <section className="space-y-3">
      <h1 className="display-font text-2xl font-bold">{title}</h1>
      <p className="text-sm text-[var(--muted)]">
        Route <code className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5">{pathname}</code> —
        not yet ported from grasskarma/site.
      </p>
    </section>
  )
}
