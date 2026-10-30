import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: ['security.policy.ts'],
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4187',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    // From the repository root, where package.json is: npm on Windows does not look upwards.
    cwd: '..',
    command: 'npm run preview -- --host 127.0.0.1 --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
  },
})
