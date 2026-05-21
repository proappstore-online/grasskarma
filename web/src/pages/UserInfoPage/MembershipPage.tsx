// Per port plan §8: subscriptions are managed by the ProAppStore platform.
// This page is a stub.
export default function MembershipPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="display-font text-2xl font-bold">Membership</h1>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        <p className="text-sm text-[var(--ink)]">Subscription managed by ProAppStore platform.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          GrassKarma is included in your $9/mo ProAppStore Pro subscription. Visit your
          {' '}
          <a
            href="https://proappstore.online/account"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            ProAppStore account
          </a>
          {' '}
          to manage billing.
        </p>
      </div>
    </section>
  )
}
