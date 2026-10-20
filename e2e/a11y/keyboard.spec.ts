import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockPlatform } from './platform'

// Keyboard-only walkthroughs (#30): each flow is reached with Tab and driven
// with Enter / typing only — no clicks — so a control that cannot be focused,
// or a focus order that skips it, fails here.

const MAX_TABS = 60

/** Press Tab until `target` has focus; fails if it is never reached. */
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error(`${target} was not reachable within ${MAX_TABS} Tab presses`)
}

async function ready(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0)
  await expect(page.locator('h1').first()).toBeVisible()
}

test('[keyboard] sign-in: the provider buttons are reachable and start sign-in', async ({ page, context }) => {
  await mockPlatform(context, 'signed-out')
  await page.goto('/')
  await ready(page)
  const start = page.waitForRequest(/\/\.pas\/auth\/start/)
  await tabTo(page, page.getByRole('button', { name: 'Sign in with Google' }))
  await page.keyboard.press('Enter')
  expect(new URL((await start).url()).searchParams.get('provider')).toBe('google')
})

test('[keyboard] skip link moves focus to the page content', async ({ page, context }) => {
  await mockPlatform(context, 'client')
  await page.goto('/app')
  await ready(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('[keyboard] the menu opens, navigates, and closes with Escape', async ({ page, context }) => {
    await mockPlatform(context, 'client')
    await page.goto('/app')
    await ready(page)
    const toggle = page.getByRole('button', { name: 'Open navigation menu' })
    await tabTo(page, toggle)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
    await expect(toggle).toBeFocused()

    await page.keyboard.press('Enter')
    await tabTo(page, page.getByRole('link', { name: 'Mowers' }))
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/mowers$/)
    await expect(page.locator('#main-content')).toBeFocused()
  })
})

test('[keyboard] join group: search by suburb and request to join', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'joiner')
  await page.goto('/app/setup')
  await ready(page)
  await tabTo(page, page.getByLabel('Suburb'))
  await page.keyboard.type('Fitzroy')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Postcode')).toBeFocused()
  await page.keyboard.type('3065')
  await tabTo(page, page.getByRole('button', { name: 'Find my group' }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: 'Request to join Gore St Fitzroy' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Requested to join' })).toBeVisible()
  expect(platform.mutations).toContainEqual(expect.objectContaining({ name: 'create_group_interest', params: expect.objectContaining({ group_id: 'g-2' }) }))
})

test('[keyboard] book a mow: create a recurring schedule', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'client')
  await page.goto('/app/manage')
  await ready(page)
  await tabTo(page, page.getByLabel('Recurring day'))
  // Typing on a focused, closed <select> picks the first matching option.
  await page.keyboard.type('Mon')
  await expect(page.getByLabel('Recurring day')).toHaveValue('1')
  await tabTo(page, page.getByRole('button', { name: 'Create schedule' }))
  await page.keyboard.press('Enter')
  await expect.poll(() => platform.mutations.map((m) => m.name)).toContain('create_schedule')
  expect(platform.mutations.find((m) => m.name === 'create_schedule')?.params).toMatchObject({ group_id: 'g-1', day_of_week: 1 })
})

test('[keyboard] group management: approve a join request', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'client')
  await page.goto('/app/manage')
  await ready(page)
  await tabTo(page, page.getByRole('button', { name: 'Approve Jordan Applicant' }))
  await page.keyboard.press('Enter')
  await expect.poll(() => platform.mutations.map((m) => m.name)).toContain('approve_group_interest')
  expect(platform.mutations.find((m) => m.name === 'approve_group_interest')?.params).toMatchObject({ interest_id: 'gi-1', user_id: 'u-applicant' })
})

test('[keyboard] profile editing: open the editor, change a field, save', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'client')
  await page.goto('/app/user/u-client')
  await ready(page)
  await tabTo(page, page.getByRole('button', { name: 'Edit' }))
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/user\/u-client\/edit$/)
  await ready(page)

  // The avatar picker is a real, focusable file input.
  await tabTo(page, page.getByLabel('Change picture'))
  await tabTo(page, page.getByLabel('Name'))
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('Alex Keyboard')
  await tabTo(page, page.getByRole('button', { name: 'Save' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  expect(platform.mutations.find((m) => m.name === 'update_me')?.params).toMatchObject({ name: 'Alex Keyboard' })
})

test('[keyboard] mow reminder: the banner shows and reminders can be turned off', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'client')
  await page.goto('/app')
  await ready(page)
  const banner = page.getByRole('region', { name: 'Mow reminder' })
  await expect(banner).toContainText('Mow tomorrow at 07:30')
  await tabTo(page, banner.getByRole('button', { name: 'Turn off reminders' }))
  await page.keyboard.press('Enter')
  await expect.poll(() => platform.mutations.map((m) => m.name)).toContain('set_reminder_opt_out')
})

test('[keyboard] mark a mow done: open the form, skip the photo, confirm', async ({ page, context }) => {
  const platform = await mockPlatform(context, 'mower')
  await page.goto('/mower')
  await ready(page)
  await tabTo(page, page.getByRole('button', { name: /^Mark as done: / }).first())
  await page.keyboard.press('Enter')
  // Opening the form moves focus to its first field, the optional photo.
  await expect(page.getByLabel('After photo (optional)')).toBeFocused()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(violations.map((v) => v.id)).toEqual([])

  await tabTo(page, page.getByRole('button', { name: 'Confirm done' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: /^Marked done: / })).toBeVisible()
  expect(platform.mutations.find((m) => m.name === 'complete_schedule')?.params).toMatchObject({ schedule_id: 's-1', group_id: 'g-1', after_photo_key: null })
})
