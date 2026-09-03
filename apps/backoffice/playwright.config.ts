import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.E2E_SUITE === 'staging' ? /e2e-staging\/.*\.spec\.ts/ : /.*\.spec\.ts/,
  testIgnore: process.env.E2E_SUITE === 'staging' ? [] : ['**/e2e-staging/**'],
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4174',
    headless: true,
  },
  webServer: {
    command: 'pnpm preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
