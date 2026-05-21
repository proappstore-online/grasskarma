# grasskarma

A pro app on ProAppStore — hyper-local lawn-care marketplace. Three roles: **client** (homeowner), **mower** (provider), **admin**. The unit of organisation is a **street group** — neighbours on the same street pool requests; mowers express interest and members vote them in.

- Subdomain: `grasskarma.proappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

For platform conventions, read
https://proappstore.online/skills.md
before writing or changing anything.

## Data model (D1, applied via `app.db.migrate()` on first load)

Schema lives in `web/src/lib/db.ts`. Row types alongside; domain types in `web/src/models/`.

- `users(id PK, email, name, photo_url, role, suburb, postcode, state, country, lat, lng, client_profile JSON, mower_profile JSON, street_group_id, created_at, updated_at)` — `role IN ('client','mower','admin')`. `client_profile` and `mower_profile` are stringified domain objects (`ClientProfile` / `MowerProfile` in `models/user.ts`).
- `street_groups(id PK, name, street_name, suburb, postcode, state, country, center_lat, center_lng, admin_ids JSON, member_ids JSON, assigned_mower_id, status, created_at, updated_at)` — `status IN ('forming','active','paused','archived')`. `admin_ids` / `member_ids` are JSON arrays of `user.id`.
- `street_group_interests(id PK, group_id, user_id, message, created_at)` — `UNIQUE(group_id, user_id)`. Client says "I want to join".
- `mower_interests(id PK, group_id, mower_id, message, created_at, updated_at)` — `UNIQUE(mower_id, group_id)`. Mower says "I'd mow this street".
- `mower_interest_votes(interest_id, voter_id, vote, created_at)` — composite PK; `vote IN (-1,1)`.
- `schedules(id PK, group_id, day_of_week, start_time, mower_id, status, due_date, completed_at, created_at, updated_at)` — `status IN ('planned','done','skipped')`.
- `mower_reviews(id PK, mower_id, reviewer_id, group_id, schedule_id, rating 1..5, comment, created_at, updated_at)`.
- `history_records(id PK, mower_id, group_id, schedule_id, street_name, area_sqm, duration_min, income, date)`.
- `platform_config(id PK, default_currency)`.

All timestamps are epoch-millis integers. Map row ↔ domain in the matching `web/src/lib/<area>.ts` file.

## Lib surface

`web/src/lib/app.ts` exports the `app` SDK instance + `dbQuery` / `dbExec` helpers. Each area has its own file:

- `users.ts` — `getMe`, `getUser`, `listUsers({ role?, suburb?, postcode? })`, `createUser`, `updateUser`, plus UI-only admin helpers `adminSetRole`, `adminDeleteUser`.
- `streetGroups.ts` — `listGroups({ status, suburb, postcode, adminId, memberId, mowerId })`, `getGroup`, `createGroup`, `updateGroup`, `addMember/removeMember/addAdmin/removeAdmin`, `deleteGroup`, `createGroupInterest`, `listGroupInterests`, `deleteGroupInterest`.
- `mowerInterests.ts` — `listInterestsForGroup/Mower`, `createMowerInterest`, `deleteMowerInterest`, `castVote(interestId, voterId, vote: -1|1)`, `listVotes`, `voteTally`.
- `schedules.ts` — `listSchedules(groupId)`, `listSchedulesForMower`, `createSchedule`, `updateSchedule`, `markCompleted`, `deleteSchedule`.
- `reviews.ts` — `createReview`, `listReviews(mowerId)`, `updateReview`, `deleteReview`, `averageRating`.
- `history.ts` — `recordHistory`, `listHistory(mowerId)`.
- `photos.ts` — `uploadAvatar / uploadLawnPhoto` (via `app.storage.uploadPublic`), `deletePhoto`.

Pages and admin operations always go through these — never call `app.db.*` directly in a page.

## Auth + role gate

`web/src/contexts/AuthContext.tsx` wraps `useProGate` (`@proappstore/sdk/hooks`) and loads the user's `users` row from D1. State machine: `loading → signed-out → no-role → ready`. First-time `no-role` lands on `RolePicker` which writes the row with role `client` or `mower`. `admin` is promoted by an existing admin, not picked.

`web/src/routes/PrivateRoute.tsx` reads `user.role` from the users row — no Firebase custom claims. Real authz is **not** server-enforced today (any signed-in user can in principle craft any SQL against this app's D1); admin operations are UI-only until the platform exposes server-side handlers. See `pas/grasskarma-port-plan.md` §0 for the full caveat.

## v1 scope cuts

- **No payments.** `pas/grasskarma-port-plan.md` §1 + §4. `MembershipPage` / `MembershipSetupPage` are stubs ("subscription managed by ProAppStore platform"). `mower_profile.ratePerM2` stays in the schema but is informational.
- **No FCM, no push.** Source repo didn't have either either; nothing to port.
- **GitHub OAuth only.** Source supported email/password + Google + Facebook; PAS is GitHub-only via `useProGate`. Real product friction for a non-developer audience — flag if onboarding drop-off shows.
- **MUI dropped** in favour of tailwind + the brand vars in `web/src/index.css` (`--accent` teal `#2D7D7D`, `--secondary` green `#5CB85C`).
- **No tests yet.** Deferred to post-launch per ship-and-test-in-prod stance.

## Files of note

- `web/src/lib/db.ts` — schema source of truth, `ensureMigrated()` cache, Row types.
- `web/src/lib/app.ts` — SDK init points at `https://pas-data-grasskarma.serge-the-dev.workers.dev`. Per-app data Worker URL is `workers.dev` rather than `data-grasskarma.proappstore.online` — same workaround dating + carsads use; see `pas/platform/PLATFORM-NOTES.md`.
- `web/index.html` — has the platform analytics loader `<script src=".../v1/analytics.js?app=grasskarma">` per the cross-store standard.
- `web/vite.config.ts` — manifest sets `min_viewport_width: 360`, theme `#2d7d7d`, name "GrassKarma".

Source repo we ported from: `github.com/grasskarma/site` (React + Firebase + MUI). Port plan + full architecture rationale at `pas/grasskarma-port-plan.md` (gitignored from the workspace repo).
