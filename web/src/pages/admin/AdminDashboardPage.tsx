import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listUsers } from '../../lib/users'
import { listGroups } from '../../lib/streetGroups'
import type { Role, StreetGroupStatus } from '../../models'

interface Stats {
  byRole: Record<Role | 'unassigned', number>
  byStatus: Record<StreetGroupStatus, number>
  totalUsers: number
  totalGroups: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const [users, groups] = await Promise.all([listUsers({ limit: 1000 }), listGroups({ limit: 1000 })])
        if (!alive) return
        const byRole: Stats['byRole'] = { client: 0, mower: 0, admin: 0, unassigned: 0 }
        for (const u of users) {
          if (u.role === 'client' || u.role === 'mower' || u.role === 'admin') byRole[u.role]++
          else byRole.unassigned++
        }
        const byStatus: Stats['byStatus'] = { forming: 0, active: 0, paused: 0, archived: 0 }
        for (const g of groups) byStatus[g.status]++
        setStats({ byRole, byStatus, totalUsers: users.length, totalGroups: groups.length })
      } catch (err) {
        console.error(err)
        if (alive) setError('Failed to load stats.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void run()
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading…</p>
  if (error) return <p className="text-sm text-[var(--error)]">{error}</p>
  if (!stats) return null

  return (
    <section className="space-y-6">
      <header>
        <h1 className="display-font text-3xl font-bold">Admin dashboard</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="display-font text-lg font-semibold">Users</h2>
            <Link to="/admin/users" className="text-sm text-[var(--accent)] hover:underline">
              View all →
            </Link>
          </div>
          <p className="display-font mt-2 text-3xl font-bold text-[var(--accent)]">{stats.totalUsers}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <Row label="Clients" value={stats.byRole.client} />
            <Row label="Mowers" value={stats.byRole.mower} />
            <Row label="Admins" value={stats.byRole.admin} />
            <Row label="Unassigned" value={stats.byRole.unassigned} />
          </ul>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="display-font text-lg font-semibold">Street groups</h2>
            <Link to="/admin/groups" className="text-sm text-[var(--accent)] hover:underline">
              View all →
            </Link>
          </div>
          <p className="display-font mt-2 text-3xl font-bold text-[var(--accent)]">{stats.totalGroups}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <Row label="Forming" value={stats.byStatus.forming} />
            <Row label="Active" value={stats.byStatus.active} />
            <Row label="Paused" value={stats.byStatus.paused} />
            <Row label="Archived" value={stats.byStatus.archived} />
          </ul>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between border-b border-[var(--line)] pb-1 last:border-b-0">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  )
}
