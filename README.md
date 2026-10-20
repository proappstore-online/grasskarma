# GrassKarma

Hyper-local lawn care on ProAppStore, at `grasskarma.proappstore.online`. Neighbours on a street form a
street group, book mows, and vote a mower in. Architecture, data model and conventions are in
[`CLAUDE.md`](CLAUDE.md).

```
pnpm install
pnpm dev            # local dev server
pnpm test           # typecheck + vitest (includes the query budgets)
pnpm build          # production build in web/dist
```

Pushing to `main` deploys. The `a11y` job in `.github/workflows/deploy.yml` gates the deploy: unit
tests, the bundle budget, and the accessibility and query-count suite in `e2e/a11y/` (see
[`e2e/README.md`](e2e/README.md)).

## Performance budgets

Budgets live in [`perf-budgets.json`](perf-budgets.json) (#31). Each one fails CI before deploy
when it is exceeded. The approach mirrors `proappstore-online/tennis-clubs`.

### Bundle size: `bundle_gzip_kb`

`node scripts/check-bundle-budget.mjs` (run after `pnpm build`) measures `web/dist` at gzip level 9:

| Budget | What | Measured (Oct 2026) | Budget |
|---|---|---|---|
| `entry_js` | The JS chunk `index.html` loads, which every visitor downloads first | 116.4 KB | 140 KB |
| `total_js` | All JS chunks, including lazy routes | 128.2 KB | 154 KB |
| `css` | All stylesheets | 4.8 KB | 6 KB |

The headroom is about 20%. The entry chunk is budgeted separately so that growth in what everyone
downloads cannot hide behind lazy loading. The mower and admin pages are lazy-loaded (`web/src/App.tsx`),
so homeowners never download them; that took the entry chunk from 124.9 KB to 120.6 KB (Vite's figure).

### Query plans, time and rows: `query_ms`, `query_max_rows`

`web/src/lib/queryBudgets.test.ts` seeds a city-scale database from the real `migrations.json`: 1,200
street groups of 5 homeowners, 300 mowers, 24,000 mows, 12,000 completions and 36,000 ratings. It runs
12 hot reads from `mcp.json` (profile load, group members, group lists, schedules, ratings, reviews,
interests, reminder opt-out) and checks three things for each:

1. **No full scan of a growing table.** This is the primary guard. The plan (`EXPLAIN QUERY PLAN`) may
   reach `users`, `street_groups`, `schedules` or any other table that grows with the user base only
   through an index. `SCAN`s of one row's JSON member and admin lists are bounded and allowed.
   `node:sqlite` cannot count rows read, and D1 bills by rows read, so the plan is the deterministic
   stand-in.
2. **Time** (`query_ms`): the median of 7 runs after a warm-up. Today's medians are 0.003–0.17 ms, so
   the budgets are 10× the measured median with a 1 ms floor. They catch large regressions without
   flaking on CI noise.
3. **Rows returned** (`query_max_rows`): the measured count plus 20%, and exactly 1 for single-row
   lookups.

`PERF_REPORT=1 pnpm --filter @grasskarma/web exec vitest run src/lib/queryBudgets.test.ts` prints the
measurements for each read.

### Server round trips per page: `page_actions`

`e2e/a11y/query-count.spec.ts` counts the registered-action calls each hot page makes while loading,
against the a11y gate's mocked platform:

| Page | Calls |
|---|---|
| client dashboard | 9 |
| mower dashboard | 8 |
| own profile | 3 |
| public mower profile | 6 |
| street group setup | 2 |
| group management | 6 |

The counts are exact, with no headroom: each call is a Worker hop plus a D1 query, so adding one is a
deliberate change. A further test checks that the client dashboard makes identical calls for a group
20 members bigger, so a page that calls once per member fails.

### Changing a budget

Fix the regression first: lazy-load the new heavy route, add an index, or batch the calls into one
action. If the growth is intended, update `perf-budgets.json` in the same commit, and say in the
commit message what grew and why. A new hot read goes in `QUERIES` in `queryBudgets.test.ts`, and a
new hot page goes in `PAGES` in `query-count.spec.ts`, each with its budget. Both tests fail if a
budget and its measurement do not list the same names.

Known loops not yet batched: group management makes one `get_user` call per pending join request,
and the mowers page makes three calls per interested mower. Both grow only with open requests, which
are few, and are measured at fixture size.
