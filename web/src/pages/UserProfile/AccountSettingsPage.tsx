import { useAuth } from '../../contexts/AuthContext'

export default function AccountSettingsPage() {
  const { user, fasUser, signOut } = useAuth()

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="display-font text-2xl font-bold">Account settings</h1>

      <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Account info</h2>
        <Row label="Name" value={user?.name ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Platform login" value={fasUser?.login ?? '—'} />
        <Row label="Role" value={user?.role ?? '—'} />
        <Row label="User ID" value={user?.id ?? '—'} mono />
        {user?.createdAt && (
          <Row label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold">Identity</h2>
        <p className="text-sm text-[var(--muted)]">
          Authentication is managed by the ProAppStore platform. Sign in / out happens through your platform
          account.
        </p>
        <button
          onClick={() => void signOut()}
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
        >
          Sign out
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--error)] bg-[var(--glass)] p-5">
        <h2 className="display-font text-lg font-semibold text-[var(--error)]">Delete account</h2>
        <p className="text-sm text-[var(--muted)]">
          Deleting your GrassKarma account removes your role and data from this app only. To delete your
          ProAppStore platform identity, visit your{' '}
          <a
            href="https://proappstore.online/account"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            ProAppStore account
          </a>
          .
        </p>
      </div>
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={`max-w-[60%] truncate text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
