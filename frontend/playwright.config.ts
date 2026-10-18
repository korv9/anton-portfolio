import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173)
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PLAYWRIGHT_PORT must be between 1024 and 65535')
const baseURL = `http://127.0.0.1:${port}`
const workers = Number(
  process.env.PLAYWRIGHT_WORKERS ?? (process.env.CI ? 2 : 1),
)
if (!Number.isInteger(workers) || workers < 1)
  throw new Error('PLAYWRIGHT_WORKERS must be a positive integer')

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers,
  reporter: 'list',
  expect: { timeout: 15000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // A preinstalled Chromium whose revision differs from this Playwright version.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'desktop',
      grepInvert: /@mobile-only/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      // Set E2E_FULL_MOBILE=1 to also run data/DOM contracts on mobile.
      grep: process.env.E2E_FULL_MOBILE ? undefined : /@mobile/,
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: `npx vite --config vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_PORT,
  },
})
