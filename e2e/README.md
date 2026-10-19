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
signed-in flows **fail** with `SMOKE SETUP MISSING` rather than skipping and reporting green.

## Run locally

```bash
cd e2e
npm install
npx playwright install chromium
npx playwright test                                      # signed-out checks only
E2E_SESSION_TOKEN=<smoke account session> npx playwright test  # all flows
```

`E2E_BASE_URL` overrides the target (default: production).
