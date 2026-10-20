#!/usr/bin/env node
// Fails when the gzipped production bundle exceeds the budgets in
// perf-budgets.json (#31). Mirrors tennis-clubs' scripts/check-bundle-budget.py.
//
// Run after `pnpm build`. Measures web/dist (or the directory given as the
// first argument):
//   entry_js  the JS chunk index.html loads: what every visitor downloads first
//   total_js  every JS chunk in assets/, including lazy-loaded routes
//   css       every stylesheet in assets/
// Sizes are gzip level 9, in KB, to match what the CDN serves.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const gzipKb = (file) => gzipSync(readFileSync(file), { level: 9 }).length / 1024

export function measure(dist) {
  const assets = join(dist, 'assets')
  const files = readdirSync(assets)
  const sum = (ext) => files.filter((f) => f.endsWith(ext)).reduce((total, f) => total + gzipKb(join(assets, f)), 0)
  const entry = readFileSync(join(dist, 'index.html'), 'utf8').match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/)?.[1]
  if (!entry) throw new Error('Could not find the entry <script type="module"> in index.html')
  return { entry_js: gzipKb(join(assets, entry)), total_js: sum('.js'), css: sum('.css') }
}

export function overBudget(sizes, budgets) {
  return Object.entries(budgets)
    .filter(([kind, budget]) => sizes[kind] > budget)
    .map(([kind, budget]) => `${kind}: ${sizes[kind].toFixed(1)} KB gzipped exceeds the ${budget} KB budget`)
}

function main() {
  const dist = resolve(process.argv[2] ?? join(root, 'web', 'dist'))
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`No build output at ${dist}. Run: pnpm build`)
    return 1
  }
  const budgets = JSON.parse(readFileSync(join(root, 'perf-budgets.json'), 'utf8')).bundle_gzip_kb
  const sizes = measure(dist)
  for (const [kind, budget] of Object.entries(budgets)) console.log(`${kind}: ${sizes[kind].toFixed(1)} KB gzipped (budget ${budget} KB)`)
  const failures = overBudget(sizes, budgets)
  for (const failure of failures) console.log(`FAIL ${failure}`)
  return failures.length ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main())
