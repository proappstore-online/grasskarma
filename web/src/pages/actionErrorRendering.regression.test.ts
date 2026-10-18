import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Each page reloads its list after a refused mutation and says so in the
// message. That message must render inline; returning it as the whole page
// would hide the reloaded list until the user navigates away.
const pages = [
  ['./admin/AdminUsersPage.tsx', 'error'],
  ['./admin/AdminGroupsPage.tsx', 'error'],
  ['./UserInfoPage/MowersPage.tsx', 'actionError'],
] as const

describe('mutation error rendering', () => {
  it.each(pages)('%s keeps the page visible when a mutation is refused', (page, actionErrorName) => {
    const source = readFileSync(new URL(page, import.meta.url), 'utf8')
    const fullPageConditions = [...source.matchAll(/^\s*if \((.*)\) return <p /gm)].map((match) => match[1])

    expect(fullPageConditions.length).toBeGreaterThan(0)
    for (const condition of fullPageConditions) expect(condition).not.toMatch(new RegExp(`\\b${actionErrorName}\\b`))
    expect(source).toContain(`{${actionErrorName} && <p`)
  })
})
