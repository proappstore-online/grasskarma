import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migratedPages = [
  '../pages/UserInfoPage/DashboardPage.tsx',
  '../pages/UserInfoPage/MowersPage.tsx',
  '../pages/UserInfoPage/ShareHirePage.tsx',
  '../pages/UserProfile/UserProfilePage.tsx',
  '../pages/UserProfile/UserProfileEditPage.tsx',
  '../pages/mower/MowerDashboardPage.tsx',
  '../pages/mower/MowerStreetsPage.tsx',
  '../pages/mower/MowerHistoryPage.tsx',
  '../pages/admin/AdminDashboardPage.tsx',
] as const

describe('read-only page-load migration', () => {
  it.each(migratedPages)('%s delegates request lifecycle to useAsyncResource', (page) => {
    const source = readFileSync(new URL(page, import.meta.url), 'utf8')

    expect(source).toContain("useAsyncResource")
    expect(source).not.toMatch(/let alive\s*=/)
    expect(source).not.toMatch(/\.finally\(\(\)\s*=>\s*alive/)
  })
})
