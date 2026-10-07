import { useEffect, useState } from 'react'
import { listGroups, updateGroup, deleteGroup } from '../../lib/streetGroups'
import { STREET_GROUP_STATUSES, type StreetGroup, type StreetGroupStatus } from '../../models'

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<StreetGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | StreetGroupStatus>('all')

  const load = async () => {
    setLoading(true)
    try {
      const list = await listGroups({ limit: 1000 })
      setGroups(list)
    } catch (err) {
      console.error(err)
      setError('Failed to load groups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleStatus = async (id: string, status: StreetGroupStatus) => {
    setBusyId(id)
    setError(null)
    try {
      await updateGroup(id, { status })
      await load()
    } catch (err) {
      console.error(err)
      await load()
      setError('Group update was refused. Groups were reloaded.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group and all associated schedules / interests? This cannot be undone.')) return
    setBusyId(id)
    setError(null)
    try {
      await deleteGroup(id)
      await load()
    } catch (err) {
      console.error(err)
      await load()
      setError('Group deletion was refused. Groups were reloaded.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = filter === 'all' ? groups : groups.filter((g) => g.status === filter)

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>

  return (
    <section className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="display-font text-2xl font-bold">Street groups</h1>
        <span className="text-sm text-[var(--muted)]">{filtered.length} shown</span>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STREET_GROUP_STATUSES] as const).map((f) => (
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
              <th className="px-4 py-2 text-left">Group</th>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-left">Members</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g) => (
              <tr key={g.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">
                  <p className="font-medium">{g.name}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{g.id.slice(0, 8)}…</p>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {g.suburb ?? '—'} {g.postcode ?? ''}
                </td>
                <td className="px-4 py-3">{g.memberIds.length}</td>
                <td className="px-4 py-3">
                  <select
                    value={g.status}
                    onChange={(e) => void handleStatus(g.id, e.target.value as StreetGroupStatus)}
                    disabled={busyId === g.id}
                    className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-xs"
                  >
                    {STREET_GROUP_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => void handleDelete(g.id)}
                    disabled={busyId === g.id}
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
                  No groups.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
