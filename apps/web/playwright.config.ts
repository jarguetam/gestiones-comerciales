import { defineConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173'
const noServer = process.env.PLAYWRIGHT_NO_SERVER === '1' || process.env.PLAYWRIGHT_NO_SERVER === 'true'

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.E2E_SUITE === 'staging' ? /e2e-staging\/.*\.spec\.ts/ : /.*\.spec\.ts/,
  testIgnore: process.env.E2E_SUITE === 'staging' ? [] : ['**/e2e-staging/**'],
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL,
    headless: true,
  },
  ...(noServer
    ? {}
    : {
        webServer: {
          command: 'pnpm preview',
          url: 'http://localhost:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
})
