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

/** The site sidebar's navigation; on a phone the menu is opened first. */
export async function siteNav(page: import('@playwright/test').Page) {
  const menu = page.locator('.side-menu-button')
  if (
    (await menu.isVisible()) &&
    (await menu.getAttribute('aria-expanded')) !== 'true'
  )
    await menu.click()
  return page.getByRole('navigation', { name: 'Site' })
}
