import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getUser, adminSetRole, adminDeleteUser } from '../../lib/users'
import { averageRating } from '../../lib/reviews'
import { listHistory } from '../../lib/history'
import type { User, Role, HistoryRecord } from '../../models'

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rating, setRating] = useState<{ average: number; count: number } | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])

  const load = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const u = await getUser(userId)
      setUser(u)
      if (u?.role === 'mower') {
        const [avg, hist] = await Promise.all([averageRating(u.id), listHistory(u.id, 10)])
        setRating(avg)
        setHistory(hist)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load user.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [userId])

  const handleRole = async (role: Role) => {
    if (!user) return
    setBusy(true)
    try {
      await adminSetRole(user.id, role)
      setUser({ ...user, role })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    if (!confirm(`Delete ${user.name ?? user.email ?? user.id}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await adminDeleteUser(user.id)
      navigate('/admin/users')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>
  if (!user) return <p className="text-sm text-[var(--muted)]">User not found.</p>

  return (
    <section className="space-y-6">
      <Link to="/admin/users" className="text-sm text-[var(--accent)] hover:underline">
        ← Back to users
      </Link>

      <div className="flex items-start gap-4 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl text-[var(--accent)]">
            {(user.name?.charAt(0) ?? '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="display-font text-2xl font-bold">{user.name ?? 'Unnamed'}</h1>
          <p className="text-sm text-[var(--muted)]">{user.email ?? '—'}</p>
          <p className="font-mono mt-1 text-xs text-[var(--muted)]">{user.id}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Role</h2>
        <div className="flex gap-2">
          {(['client', 'mower', 'admin'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => void handleRole(r)}
              disabled={busy}
              className={`rounded-md px-3 py-1.5 text-sm ${
                user.role === r
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
              } disabled:opacity-50`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {user.role === 'mower' && rating && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <h2 className="display-font text-lg font-semibold">Mower stats</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-[var(--muted)]">Average rating</dt>
            <dd>★ {rating.average.toFixed(1)} ({rating.count})</dd>
            <dt className="text-[var(--muted)]">Recent jobs</dt>
            <dd>{history.length}</dd>
            <dt className="text-[var(--muted)]">Total income (recent)</dt>
            <dd>${history.reduce((s, h) => s + (h.income ?? 0), 0).toLocaleString()}</dd>
          </dl>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Profile</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-[var(--muted)]">Suburb</dt>
          <dd>{user.suburb ?? '—'}</dd>
          <dt className="text-[var(--muted)]">Postcode</dt>
          <dd>{user.postcode ?? '—'}</dd>
          <dt className="text-[var(--muted)]">State</dt>
          <dd>{user.state ?? '—'}</dd>
          {user.streetGroupId && (
            <>
              <dt className="text-[var(--muted)]">Street group</dt>
              <dd className="font-mono text-xs">{user.streetGroupId}</dd>
            </>
          )}
          <dt className="text-[var(--muted)]">Created</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
        </dl>
      </div>

      <div className="rounded-lg border border-[var(--error)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold text-[var(--error)]">Delete user</h2>
        <button
          onClick={() => void handleDelete()}
          disabled={busy}
          className="mt-3 rounded-md bg-[var(--error)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          Delete user
        </button>
      </div>
    </section>
  )
}
