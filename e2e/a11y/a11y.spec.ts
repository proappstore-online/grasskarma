import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockPlatform, type Persona } from './platform'

// Accessibility + mobile gate (#30). Runs against a local `vite preview` of the
// production build with the platform mocked (./platform.ts), so it can block a
// deploy without a session or network. Every route is checked at 360px and
// 414px (mobile) and 1280px (desktop), in the light theme, and once more in the
// dark theme, for:
//   - axe-core WCAG 2.2 A/AA violations
//   - horizontal page scroll
//   - tap targets (mobile widths only): every button, field and standalone
//     link at least 44px tall; links inside running text are exempt

const ROUTES: { persona: Persona; path: string; name: string }[] = [
  { persona: 'signed-out', path: '/', name: 'sign-in' },
  { persona: 'newcomer', path: '/', name: 'role picker' },
  { persona: 'client', path: '/app', name: 'client dashboard' },
  { persona: 'joiner', path: '/app/setup', name: 'street group setup' },
  { persona: 'client', path: '/app/manage', name: 'group management' },
  { persona: 'client', path: '/app/mowers', name: 'interested mowers' },
  { persona: 'client', path: '/app/sharehire', name: 'share / hire' },
  { persona: 'client', path: '/app/membership', name: 'membership' },
  { persona: 'client', path: '/app/membership/setup', name: 'membership setup' },
  { persona: 'client', path: '/app/user/u-client', name: 'own profile' },
  { persona: 'client', path: '/app/user/u-client/edit', name: 'profile editor' },
  { persona: 'client', path: '/app/user/u-mower', name: "a mower's profile" },
  { persona: 'client', path: '/app/preferences', name: 'preferences' },
  { persona: 'client', path: '/app/account', name: 'account settings' },
  { persona: 'client', path: '/app/no-such-page', name: 'not found' },
  { persona: 'client', path: '/mower/u-mower', name: 'public mower profile' },
  { persona: 'mower', path: '/mower', name: 'mower dashboard' },
  { persona: 'mower', path: '/mower/setup', name: 'mower setup' },
  { persona: 'mower', path: '/mower/streets', name: 'mower streets' },
  { persona: 'mower', path: '/mower/history', name: 'mower history' },
  { persona: 'mower', path: '/mower/user/u-mower/edit', name: 'mower profile editor' },
  { persona: 'mower', path: '/mower/account', name: 'mower account settings' },
  { persona: 'admin', path: '/admin', name: 'admin dashboard' },
  { persona: 'admin', path: '/admin/users', name: 'admin users' },
  { persona: 'admin', path: '/admin/users/u-mower', name: 'admin user detail' },
  { persona: 'admin', path: '/admin/groups', name: 'admin groups' },
]

const VIEWPORTS = [
  { name: '360px', width: 360, height: 780, mobile: true },
  { name: '414px', width: 414, height: 896, mobile: true },
  { name: 'desktop', width: 1280, height: 800, mobile: false },
]

const MIN_TAP_TARGET = 44

async function settle(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0)
  await expect(page.locator('h1').first()).toBeVisible()
}

async function axeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(1).join('; ')}`).join('\n')}`)
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    if (doc.scrollWidth <= doc.clientWidth) return null
    const wide = [...document.querySelectorAll<HTMLElement>('main *, header *')]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5)
      .slice(0, 5)
      .map((el) => `<${el.tagName.toLowerCase()} class="${el.className}">`)
    return `page is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport; overflowing: ${wide.join(', ')}`
  })
}

async function smallTapTargets(page: Page) {
  return page.evaluate((min) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return r.width > 1 && r.height > 1 && style.visibility !== 'hidden'
    }
    const controls = [...document.querySelectorAll<HTMLElement>('button, select, textarea, input, a[href]')].flatMap((el) => {
      // Checkboxes and radios are sized by the label wrapping them.
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) return el.closest('label') ?? []
      // Links inside running text are exempt (WCAG 2.5.8 inline exception).
      if (el instanceof HTMLAnchorElement && getComputedStyle(el).display === 'inline') return []
      return el
    })
    return [...new Set(controls)]
      .filter(visible)
      .filter((el) => el.getBoundingClientRect().height < min - 0.5)
      .map((el) => `${Math.round(el.getBoundingClientRect().height)}px <${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 40) || el.getAttribute('aria-label')}"`)
  }, MIN_TAP_TARGET)
}

for (const viewport of VIEWPORTS) {
  test.describe(`[a11y ${viewport.name}]`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const route of ROUTES) {
      test(`${route.name} (${route.path})`, async ({ page, context }) => {
        const platform = await mockPlatform(context, route.persona)
        await page.goto(route.path)
        await settle(page)

        expect(await axeViolations(page), 'axe violations').toEqual([])
        expect(await horizontalOverflow(page), 'horizontal overflow').toBeNull()
        if (viewport.mobile) expect(await smallTapTargets(page), 'tap targets too small').toEqual([])
        expect(platform.unhandled, 'requests the platform mock could not answer').toEqual([])
      })
    }
  })
}

test.describe('[a11y dark theme]', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page, context }) => {
      const platform = await mockPlatform(context, route.persona)
      await page.goto(route.path)
      await settle(page)
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))

      expect(await axeViolations(page), 'axe violations').toEqual([])
      expect(platform.unhandled, 'requests the platform mock could not answer').toEqual([])
    })
  }
})
