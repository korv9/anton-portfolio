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
    await page.addInitScript((lang) => {
      try {
        if (lang && !localStorage.getItem('anton-portfolio-language'))
          localStorage.setItem('anton-portfolio-language', lang as string)
      } catch {
        /* storage blocked */
      }
    }, language)
    await use(page)
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
