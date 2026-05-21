import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { listHistory } from '../../lib/history'
import type { HistoryRecord } from '../../models'

const fmtMoney = (n: number | null) =>
  n == null ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'AUD' })
const fmtDur = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h ${m % 60}m`)

export default function MowerHistoryPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<HistoryRecord | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    listHistory(user.id)
      .then((list) => alive && setItems(list))
      .catch((err) => {
        console.error(err)
        if (alive) setError('Failed to load history.')
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [user])

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>

  return (
    <section className="space-y-6">
      <header>
        <h1 className="display-font text-2xl font-bold">Job history</h1>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No records yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--glass)]">
          {items.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--accent-soft)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.streetName ?? '—'}</p>
                  <p className="text-xs text-[var(--muted)]">{new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-medium text-[var(--accent)]">{fmtMoney(r.income)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--paper)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="display-font text-lg font-semibold">{selected.streetName ?? 'Job'}</h2>
            <p className="text-xs text-[var(--muted)]">{new Date(selected.date).toLocaleDateString()}</p>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-[var(--muted)]">Income</dt>
              <dd>{fmtMoney(selected.income)}</dd>
              <dt className="text-[var(--muted)]">Area</dt>
              <dd>{selected.areaSqm != null ? `${selected.areaSqm} m²` : '—'}</dd>
              <dt className="text-[var(--muted)]">Duration</dt>
              <dd>{fmtDur(selected.durationMin)}</dd>
            </dl>
            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
