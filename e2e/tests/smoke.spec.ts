import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  action,
  cleanUpSmokeAccount,
  hasSession,
  signInBrowser,
  smokeAccountId,
  SMOKE_ACCOUNT_NAME,
  SMOKE_POSTCODE,
  SMOKE_STREET_PREFIX,
  SMOKE_SUBURB,
} from '../smoke'

// Live post-deploy smoke tests (#27). Each title starts with the flow it
// covers, so a failure in the deploy log names the broken flow.

test('[sign-in] the live app boots to the sign-in screen without page errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible({ timeout: 20_000 })
  expect(pageErrors).toEqual([])
})

// Google refuses automated sign-ins, so the smoke test proves our half of the
// flow: the button reaches Google's sign-in page with a callback to the
// platform. The signed-in half is covered below with a platform session, the
// same HttpOnly cookie the Google callback sets.
test('[sign-in] "Sign in with Google" hands off to Google with a platform callback', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await page.waitForURL(/^https:\/\/accounts\.google\.com\//, { waitUntil: 'commit', timeout: 30_000 })
  const redirectUri = new URL(page.url()).searchParams.get('redirect_uri') ?? ''
  expect(redirectUri, 'Google must call back to the ProAppStore platform').toMatch(/^https:\/\/[^/]*proappstore\.online\//)
})

test.describe('signed in as the SMOKE TEST ACCOUNT', () => {
  test.describe.configure({ mode: 'serial' })

  const runId = process.env.GITHUB_RUN_ID || String(Date.now())
  const streetName = `${SMOKE_STREET_PREFIX} ${runId}`
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser, request }) => {
    if (!hasSession) {
      // In CI a missing session must fail, not skip: a skipped suite reports
      // green while testing nothing.
      if (process.env.CI) {
        throw new Error(
          'SMOKE SETUP MISSING: no smoke-account session. The deploy job mints one with ' +
          'POST /v1/auth/exchange/oidc, which needs a platform-admin grant for this repository and ' +
          '.github/workflows/deploy.yml (see e2e/README.md), or set the PAS_E2E_SESSION_TOKEN secret.',
        )
      }
      test.skip(true, 'Set E2E_SESSION_TOKEN to run the signed-in flows (see e2e/README.md).')
    }
    await cleanUpSmokeAccount(request)
    context = await browser.newContext()
    await signInBrowser(context)
    page = await context.newPage()
  })

  test.afterAll(async ({ request }) => {
    await context?.close()
    if (hasSession) await cleanUpSmokeAccount(request)
  })

  test('[sign-in] a platform session signs in and onboards as a homeowner', async ({ request }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /I'm a homeowner/ }).click()
    await expect(page.getByRole('heading', { name: 'Set up your street group' })).toBeVisible({ timeout: 20_000 })
    // Mark the new profile straight away so cleanup can recognise it.
    const result = await action(request, 'update_me', { set_name: 1, name: SMOKE_ACCOUNT_NAME })
    expect(result.meta?.changes).toBe(1)
  })

  test('[street group] create a SMOKE TEST street group from the setup page', async () => {
    const field = (label: string) => page.locator(`label:text-is("${label}") + input`)
    await field('Suburb').fill(SMOKE_SUBURB)
    await field('Postcode').fill(SMOKE_POSTCODE)
    await page.getByRole('button', { name: 'Find my group' }).click()
    await expect(page.getByRole('heading', { name: 'Create a new group' })).toBeVisible()
    await field('Street name').fill(streetName)
    await page.getByRole('button', { name: 'Create group' }).click()
    await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: `${streetName} ${SMOKE_SUBURB}` })).toBeVisible()
  })

  // Scheduling from the Manage page needs an assigned mower, which would need a
  // second (mower) account. The smoke books through the same registered action
  // with no mower, then checks the live dashboard shows it.
  test('[book a mow] book a mow for the group and see it on the dashboard', async ({ request }) => {
    const userId = await smokeAccountId(request)
    const me = (await action<{ street_group_id: string | null }>(request, 'get_user', { id: userId })).rows?.[0]
    expect(me?.street_group_id, 'the smoke account should belong to its new group').toBeTruthy()
    const booked = await action(request, 'create_schedule', {
      id: `smoke-${runId}`,
      group_id: me!.street_group_id,
      day_of_week: null,
      start_time: '09:00',
      mower_id: null,
      due_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
    expect(booked.meta?.changes, 'create_schedule must book exactly one mow').toBe(1)

    await page.goto('/app')
    await expect(page.getByText('at 09:00')).toBeVisible({ timeout: 20_000 })
  })
})
