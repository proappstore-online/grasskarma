import { defineConfig, devices } from '@playwright/test'

// Pre-deploy accessibility + mobile gate (#30). Unlike playwright.config.ts
// (live smoke tests against production), this drives a local `vite preview`
// of the production build with the platform mocked, so it needs no session
// and runs before anything ships. Build first: `pnpm build` at the repo root.
const PORT = 4173

export default defineConfig({
  testDir: './a11y',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The PWA service worker would answer requests itself, out of reach of
    // the platform mock's routes.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  // A11Y_BROWSER_CHANNEL=chrome runs against an installed Chrome instead of
  // Playwright's bundled Chromium (CI installs and uses the bundled one).
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.A11Y_BROWSER_CHANNEL || undefined } }],
  webServer: {
    command: `pnpm --dir .. preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
