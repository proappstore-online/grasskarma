// Per port plan §8: membership / subscription is platform-managed. Stub page.
export default function MembershipSetupPage() {
  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="display-font text-2xl font-bold">Membership set-up</h1>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--glass)] p-6">
        <p className="text-sm text-[var(--ink)]">Subscription managed by ProAppStore platform.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Per-group billing has been removed. All Pro apps are bundled in your $5/mo ProAppStore Pro
          subscription.
        </p>
      </div>
    </section>
  )
}
