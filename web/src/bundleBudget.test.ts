// The bundle budget check (#31): budgets parse, cover every measured kind, and
// the script measures the entry chunk separately from lazy chunks.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type BudgetScript = {
  measure: (dist: string) => Record<string, number>
  overBudget: (sizes: Record<string, number>, budgets: Record<string, number>) => string[]
}
const root = new URL('../../', import.meta.url)
const { measure, overBudget } = (await import(new URL('scripts/check-bundle-budget.mjs', root).href)) as BudgetScript
const budgets: Record<string, number> = JSON.parse(readFileSync(new URL('perf-budgets.json', root), 'utf8')).bundle_gzip_kb

function fakeDist() {
  const dist = mkdtempSync(join(tmpdir(), 'gk-dist-'))
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'index.html'), '<script type="module" crossorigin src="/assets/index-abc.js"></script>')
  writeFileSync(join(dist, 'assets', 'index-abc.js'), 'x'.repeat(4096))
  writeFileSync(join(dist, 'assets', 'AdminPage-def.js'), 'y'.repeat(4096))
  writeFileSync(join(dist, 'assets', 'index-abc.css'), 'z'.repeat(4096))
  return dist
}

describe('bundle budget', () => {
  it('budgets every measured kind', () => {
    expect(Object.keys(budgets).sort()).toEqual(Object.keys(measure(fakeDist())).sort())
  })

  it('measures the entry chunk apart from lazy chunks', () => {
    const sizes = measure(fakeDist())
    expect(sizes.total_js).toBeGreaterThan(sizes.entry_js!)
    expect(sizes.entry_js).toBeGreaterThan(0)
    expect(sizes.css).toBeGreaterThan(0)
  })

  it('reports each kind over its budget', () => {
    expect(overBudget({ entry_js: 141, total_js: 100, css: 7 }, { entry_js: 140, total_js: 154, css: 6 })).toEqual([
      'entry_js: 141.0 KB gzipped exceeds the 140 KB budget',
      'css: 7.0 KB gzipped exceeds the 6 KB budget',
    ])
    expect(overBudget({ entry_js: 140, total_js: 154, css: 6 }, { entry_js: 140, total_js: 154, css: 6 })).toEqual([])
  })
})
