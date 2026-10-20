import { expect, test, type Page } from '@playwright/test'
import { mockPlatform, type Persona } from './platform'
import perfBudgets from '../../perf-budgets.json' with { type: 'json' }

// Query-count budgets (#31): the server round trips (registered-action calls)
// each hot page makes to load, against perf-budgets.json page_actions. A
// round trip is the expensive unit on PAS: one Worker hop and one D1 query
// each. Counts are exact (no headroom): adding a call is a deliberate budget
// change, recorded in README.md.
const budgets: Record<string, number> = perfBudgets.page_actions

const PAGES: Record<string, { persona: Persona; path: string }> = {
  'client dashboard': { persona: 'client', path: '/app' },
  'mower dashboard': { persona: 'mower', path: '/mower' },
  'own profile': { persona: 'client', path: '/app/user/u-client' },
  'public mower profile': { persona: 'client', path: '/mower/u-mower' },
  'street group setup': { persona: 'joiner', path: '/app/setup' },
  'group management': { persona: 'client', path: '/app/manage' },
}

/** Load a page and wait until it has stopped calling the platform. */
async function load(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0)
  await expect(page.locator('h1').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
}

test('[query count] budgets exactly the measured pages', () => {
  expect(Object.keys(budgets).sort()).toEqual(Object.keys(PAGES).sort())
})

for (const [name, { persona, path }] of Object.entries(PAGES)) {
  test(`[query count] ${name} (${path})`, async ({ page, context }) => {
    const platform = await mockPlatform(context, persona)
    await load(page, path)
    // The call list is attached to the report, for updating the budget.
    test.info().annotations.push({ type: 'calls', description: `${platform.calls.length}: ${platform.calls.join(', ')}` })
    expect(platform.calls.length, platform.calls.join(', ')).toBeLessThanOrEqual(budgets[name]!)
  })
}

test('[query count] the client dashboard makes the same calls for a bigger group', async ({ page, context, browser }) => {
  const small = await mockPlatform(context, 'client')
  await load(page, '/app')
  const bigContext = await browser.newContext({ serviceWorkers: 'block', baseURL: test.info().project.use.baseURL })
  const big = await mockPlatform(bigContext, 'client', { extraMembers: 20 })
  const bigPage = await bigContext.newPage()
  await load(bigPage, '/app')
  await expect(bigPage.getByText('Extra Neighbour 19')).toBeVisible()
  expect(big.calls.sort()).toEqual(small.calls.sort())
  await bigContext.close()
})
