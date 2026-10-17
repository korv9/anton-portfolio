import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

// Vite preview does not serve _headers. Apply the built Cloudflare policy to responses.
const globalRule = readFileSync(
  new URL('../../dist/_headers', import.meta.url),
  'utf8',
)
  .replace(/\r\n/g, '\n')
  .split('/*\n')[1]
  .split('\n\n')[0]
const headers = Object.fromEntries(
  globalRule
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const colon = line.indexOf(':')
      return [
        line.slice(0, colon).trim().toLowerCase(),
        line.slice(colon + 1).trim(),
      ]
    }),
)

test('the built site loads under CSP and blocks injected scripts', async ({
  page,
}) => {
  const violations: string[] = []
  await page.exposeFunction('recordPolicyViolation', (directive: string) => {
    violations.push(directive)
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void (
        window as unknown as {
          recordPolicyViolation: (directive: string) => Promise<void>
        }
      ).recordPolicyViolation(event.effectiveDirective)
    })
  })
  await page.route('http://127.0.0.1:4187/**', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), ...headers },
    })
  })
  await page.goto('/')
  await expect(page.locator('#home-name')).toHaveText('Anton Ernstsson')
  const canViewPdf = await page.evaluate(() => navigator.pdfViewerEnabled)
  const pdfResponse = canViewPdf
    ? page.waitForResponse((response) => response.url().endsWith('.pdf'))
    : undefined
  await page
    .getByRole('button', { name: /View CV|Visa CV/ })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  if (pdfResponse) {
    expect((await pdfResponse).status()).toBe(200)
    await expect(page.locator('iframe.cv-document')).toHaveAttribute(
      'src',
      /\.pdf$/,
    )
  } else {
    await expect(page.locator('.cv-viewer-fallback')).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await page.goto('/#projects')
  await expect(page.locator('#root')).toContainText('Projects')
  expect(violations).toEqual([])

  await page.evaluate(() => {
    const script = document.createElement('script')
    script.textContent = "document.documentElement.dataset.injected = 'yes'"
    document.head.append(script)
    const remote = document.createElement('script')
    remote.src = 'https://example.invalid/injected.js'
    document.head.append(remote)
  })
  await expect.poll(() => violations.length).toBeGreaterThanOrEqual(2)
  await expect(page.locator('html')).not.toHaveAttribute('data-injected')
  expect(violations.every((directive) => directive === 'script-src-elem')).toBe(
    true,
  )
})
