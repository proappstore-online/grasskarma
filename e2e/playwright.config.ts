import { defineConfig, devices } from '@playwright/test'

// Drives the LIVE deployed app. The deploy workflow sets E2E_BASE_URL to
// https://grasskarma.proappstore.online; local runs default to the same host.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // The signed-in flows share one smoke account and build on each other, so
  // they run serially in one worker.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The deploy workflow's "Publish test results" step reads ./results.json.
  reporter: [['json', { outputFile: 'results.json' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://grasskarma.proappstore.online',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
