import { readFile } from 'node:fs/promises'
import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const pdf = '/cv/Anton_Ernstsson_CV_final.pdf'

test(
  'the CV opens in a viewer, closes and restores focus without downloading',
  { tag: '@mobile' },
  async ({ page }) => {
    const downloads: string[] = []
    page.on('download', (download) =>
      downloads.push(download.suggestedFilename()),
    )
    for (const entry of ['.home-contact']) {
      await page.goto('/#om-mig')
      const button = page
        .locator(entry)
        .getByRole('button', { name: 'View CV' })
      await button.click()
      const viewer = page.getByRole('dialog', { name: 'Anton Ernstsson · CV' })
      await expect(viewer).toBeVisible()
      await expect(page.locator('dialog')).toHaveCount(1)
      const close = viewer.getByRole('button', { name: 'Close CV' })
      await expect(close).toBeFocused()
      await expect(
        viewer.getByRole('link', { name: 'Download CV' }),
      ).toHaveAttribute('href', pdf)
      if (await page.evaluate(() => navigator.pdfViewerEnabled)) {
        await expect(viewer.locator('iframe')).toHaveAttribute('src', pdf)
        const response = await page.request.get(pdf)
        expect(response.headers()['content-type']).toContain('application/pdf')
        expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
      } else {
        await expect(viewer.locator('.cv-viewer-fallback')).toBeVisible()
      }
      const position = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, 400)
      expect(await page.evaluate(() => scrollY)).toBe(position)
      await expect(page.locator('body')).toHaveCSS('position', 'fixed')
      await close.click()
      await expect(viewer).not.toBeVisible()
      await expect(button).toBeFocused()
      await expect(page.locator('body')).not.toHaveCSS('position', 'fixed')
    }
    expect(downloads).toEqual([])
  },
)

test(
  'Download CV returns the actual current document',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#om-mig')
    await page
      .locator('.home-contact')
      .getByRole('button', { name: 'View CV' })
      .click()
    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('dialog')
      .getByRole('link', { name: 'Download CV' })
      .click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('Anton_Ernstsson_CV_final.pdf')
    expect(await readFile((await download.path())!)).toEqual(
      await readFile(new URL(`../public${pdf}`, import.meta.url)),
    )
    await expect(page.getByRole('dialog')).toBeVisible()
  },
)

test(
  'keyboard and reduced motion work with the PDF fallback',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'pdfViewerEnabled', {
        get: () => false,
      }),
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#om-mig')
    const button = page
      .locator('.home-contact')
      .getByRole('button', { name: 'View CV' })
    await button.focus()
    await page.keyboard.press('Enter')
    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()
    await expect(viewer).toHaveCSS('animation-name', 'none')
    await expect(viewer.locator('.cv-viewer-fallback')).toBeVisible()
    await expect(viewer.locator('iframe')).toHaveCount(0)
    await expect(
      viewer.getByRole('link', { name: 'open the PDF in a new tab' }),
    ).toHaveAttribute('href', pdf)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(
        await viewer.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true)
    }
    const results = await new AxeBuilder({ page })
      .include('.cv-viewer')
      .analyze()
    expect(results.violations).toEqual([])
    await page.keyboard.press('Escape')
    await expect(viewer).not.toBeVisible()
    await expect(button).toBeFocused()
  },
)

test(
  'the introduction and contact copy describe production work and the roles sought',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#om-mig')
    await expect(page.locator('.home-about-text').first()).toContainText(
      'I love exploring data in creative ways',
    )
    await expect(page.locator('.home-contact-intro')).toContainText(
      'I’d especially like to hear from you',
    )
    expect(
      await page
        .locator('.home-contact-intro')
        .evaluate((el) => el.nextElementSibling?.className),
    ).toBe('home-contact-email')
    await expect(page.locator('.home-about-text').nth(1)).toContainText(
      'delivering in production',
    )
    await expect(page.locator('.home-about-text').nth(1)).toContainText(
      'roles in software development, data and AI',
    )
  },
)
