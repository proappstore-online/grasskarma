# Live smoke tests

Post-deploy smoke tests against **production** (`grasskarma.proappstore.online`), #27.
The deploy workflow's `e2e` job runs them after every deploy to `main`.

| Flow | What is checked |
|---|---|
| `[sign-in]` | The app boots to the sign-in screen. "Sign in with Google" reaches Google with a ProAppStore callback. A platform session (the cookie the Google callback sets) signs in and onboards as a homeowner. |
| `[street group]` | The setup page searches a suburb and creates a street group. |
| `[book a mow]` | A mow is booked for that group (`create_schedule`) and shows on the dashboard. |

Each test title starts with its flow, so a failure names the broken flow.

Google blocks automated sign-ins, so the suite does not complete a Google login. It checks the
hand-off to Google and then signs in with a platform session, the same `__Host-pas_session`
cookie the callback sets.

## Smoke test account and data

The signed-in flows run as **one dedicated smoke-test account**. Never use a real person's account.

- The profile is renamed `SMOKE TEST ACCOUNT (automated, deleted after each run)` as soon as it is created.
- The group is on street `SMOKE TEST <run id>`, suburb `Smoketest`, postcode `0000`.
- The mow booking id is `smoke-<run id>`.

Cleanup runs before the flows (to clear a failed earlier run) and after them. It deletes the
SMOKE TEST group, with its schedules and requests, and then the account's GrassKarma profile.
If the profile is not marked as the smoke account, or it belongs to a group that is not a
smoke group, cleanup refuses to delete anything and the run fails.

## Session in CI

The job mints a session keylessly from the workflow's GitHub OIDC token
(`POST /v1/auth/exchange/oidc`). This needs a one-time grant from a platform admin:

```
POST https://api.proappstore.online/v1/admin/oidc-session-grants
{ "repository": "proappstore-online/grasskarma",
  "workflow": ".github/workflows/deploy.yml", "user_id": "<dedicated smoke account id>" }
```

Without a grant, the job falls back to the `PAS_E2E_SESSION_TOKEN` secret. With neither, the
signed-in flows are **skipped**. The job then posts a `SMOKE SETUP MISSING` warning and a banner in
the run summary. A missing session is a setup gap, not a broken flow, so it does not fail the
deploy run. A flow that runs and breaks does fail it, naming the flow.

## Run locally

```bash
cd e2e
npm install
npx playwright install chromium
npx playwright test                                      # signed-out checks only
E2E_SESSION_TOKEN=<smoke account session> npx playwright test  # all flows
```

`E2E_BASE_URL` overrides the target (default: production).

## Accessibility and mobile gate (`a11y/`, #30)

A second suite, run **before** deploy by the `a11y` job in `deploy.yml`. It drives a local
`vite preview` of the commit's build, not production, with the platform mocked in-browser by
`a11y/platform.ts` (fixture rows shaped like the D1 tables; any request it cannot answer fails the
test). No session or network is needed, so a regression blocks the deploy.

| Spec | What is checked |
|---|---|
| `a11y.spec.ts` | Every route, per role, at 360px, 414px and 1280px plus a dark-theme pass: axe-core WCAG 2.2 A/AA + best-practice violations, no horizontal page scroll, and (mobile) every button, field and standalone link at least 44px tall. Links inside running text are exempt. |
| `keyboard.spec.ts` | Tab/Enter-only walkthroughs: sign-in, skip link, mobile menu (incl. Escape), join a group, book a mow, approve a join request, edit and save a profile. |

Run locally from this directory after `pnpm build` at the repo root:

```
npx playwright test -c playwright.a11y.config.ts
```

`A11Y_BROWSER_CHANNEL=chrome` uses an installed Chrome instead of Playwright's bundled Chromium.
A new route goes in `ROUTES` in `a11y.spec.ts`; a new registered action the pages call needs a
handler in `a11y/platform.ts`.
