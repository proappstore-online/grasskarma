import { Link, useRouteError } from 'react-router-dom'

export function ErrorPage() {
  const err = useRouteError() as { statusText?: string; message?: string } | undefined
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="display-font text-3xl font-bold">Something went wrong</h1>
      <p className="text-[var(--muted)]">{err?.statusText ?? err?.message ?? 'Unknown error.'}</p>
      <Link to="/" className="rounded-2xl bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white">
        Back to start
      </Link>
    </div>
  )
}
