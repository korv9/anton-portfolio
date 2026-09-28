/**
 * The site's Playwright `test`: English copy (the tests assert the English wording; Swedish is
 * the site's default) and the name intro already seen, so tests start on the content. A test
 * that is about the language or the intro sets `language` or `intro` itself.
 */
import { test as base, expect } from '@playwright/test'

export const test = base.extend<{
  language: 'en' | 'sv' | null
  intro: boolean
}>({
  language: ['en', { option: true }],
  intro: [false, { option: true }],
  page: async ({ page, language, intro }, use) => {
    await page.addInitScript(
      ([lang, showIntro]) => {
        try {
          if (lang && !localStorage.getItem('anton-portfolio-language'))
            localStorage.setItem('anton-portfolio-language', lang as string)
          if (!showIntro) sessionStorage.setItem('ae-intro-seen', '1')
        } catch {
          /* storage blocked */
        }
      },
      [language, intro] as const,
    )
    await use(page)
  },
})
export { expect }
