import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
