import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listUsers, adminSetRole, adminDeleteUser } from '../../lib/users'
import type { User, Role } from '../../models'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Role>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await listUsers({ limit: 1000 })
      setUsers(list)
    } catch (err) {
      console.error(err)
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleRoleChange = async (id: string, role: Role) => {
    setUpdatingId(id)
    try {
      await adminSetRole(id, role)
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    setUpdatingId(id)
    try {
      await adminDeleteUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter)

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>

  return (
    <section className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="display-font text-2xl font-bold">Users</h1>
        <span className="text-sm text-[var(--muted)]">{filtered.length} shown</span>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['all', 'client', 'mower', 'admin'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === f
                ? 'bg-[var(--accent)] text-white'
                : 'border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--glass)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-left">Joined</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">
                  <Link to={`/admin/users/${u.id}`} className="hover:underline">
                    <p className="font-medium">{u.name ?? 'Unnamed'}</p>
                    <p className="text-xs text-[var(--muted)]">{u.email ?? '—'}</p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role ?? ''}
                    onChange={(e) => void handleRoleChange(u.id, e.target.value as Role)}
                    disabled={updatingId === u.id}
                    className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs"
                  >
                    <option value="client">client</option>
                    <option value="mower">mower</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {u.suburb ?? '—'} {u.postcode ?? ''}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => void handleDelete(u.id)}
                    disabled={updatingId === u.id}
                    className="text-xs text-[var(--error)] hover:underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                  No users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
