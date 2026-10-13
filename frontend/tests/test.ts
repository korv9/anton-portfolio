/**
 * The site's Playwright `test`: English copy (the tests assert the English wording; Swedish is
 * the site's default). A test that is about the language sets `language` itself.
 */
import { test as base, expect } from '@playwright/test'

export const test = base.extend<{
  language: 'en' | 'sv' | null
}>({
  language: ['en', { option: true }],
  page: async ({ page, language }, use) => {
    // UI contracts use committed snapshots; live delivery has its own opt-in checks.
    if (!process.env.E2E_LIVE_DELIVERY) {
      // Offloaded fixtures remain readable from an isolated local test port.
      if (process.env.PLAYWRIGHT_PORT) {
        await page.route(
          /^https:\/\/(pub-[a-f0-9]+\.r2\.dev|data\.antonernstsson\.com)\//,
          async (route) => route.fulfill({ response: await route.fetch() }),
        )
      }
      await page.route('**/data/delivery.json', async (route) => {
        const response = await route.fetch()
        const delivery = await response.json()
        delete delivery.manifest_url
        await route.fulfill({ json: delivery })
      })
    }
    await page.addInitScript((lang) => {
      try {
        if (lang && !localStorage.getItem('anton-portfolio-language'))
          localStorage.setItem('anton-portfolio-language', lang as string)
      } catch {
        /* storage blocked */
      }
    }, language)
    await use(page)
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  },
})
export { expect }

/** Open the shared project menu on either viewport. */
export async function siteNav(page: import('@playwright/test').Page) {
  const menu = page.locator('.project-menu')
  if (!((await menu.getAttribute('open')) != null))
    await menu.locator('summary').click()
  return page.locator('.project-menu-panel')
}
