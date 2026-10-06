/**
 * Every internal link leads somewhere. The site routes on the hash, and an address the router
 * does not know falls back to the homepage without an error, so a mistyped link would look
 * like it works. This walks the links the site shows (header menus, homepage, projects page,
 * every project's own pages and their pagers and footers) and opens each one: it must open
 * a page other than the homepage, or be a section of the homepage that exists, and open
 * without a script error.
 */
import { test, expect, type Page } from './test'

// Sections of the homepage a link may point at; any other address is a page of its own.
const HOME = '#start'
const START_PAGES = [
  '/#start',
  '/#alla-projekt',
  '/#politik',
  '/#ai-act',
  '/#jobb',
  '/#symbolic-atlas',
  '/#sweden',
  '/#thesis',
  '/#data-constellation',
  '/#quality',
]

async function linksOn(page: Page): Promise<string[]> {
  // Open the header menus so their links are in the page too.
  for (const name of ['Projects', 'CV']) {
    const button = page.locator('.global-nav').getByRole('button', { name })
    if (await button.isVisible()) {
      await button.click()
      await page.keyboard.press('Escape')
    }
  }
  return page.$$eval('a[href^="#"]', (as) =>
    as.map((a) => a.getAttribute('href')!.split('?')[0]),
  )
}

test('no link is a placeholder and every control has a name', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same markup on a phone')
  for (const start of START_PAGES) {
    await page.goto(start)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="#"], a:not([href])')).toHaveCount(0)
    const unnamed = await page.$$eval('button, [role="button"]', (els) =>
      els
        .filter((el) => {
          const label =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            el.getAttribute('title') ||
            el.textContent?.trim()
          return !label
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    )
    expect(unnamed, `${start}: buttons without a name`).toEqual([])
  }
})

test('every internal link opens a page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the same links on a phone')
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))

  const links = new Set<string>()
  for (const start of START_PAGES) {
    await page.goto(start)
    await page.waitForLoadState('networkidle')
    for (const href of await linksOn(page)) links.add(href)
  }
  expect(links.size).toBeGreaterThan(30)
  test
    .info()
    .annotations.push({ type: 'links', description: String(links.size) })

  await page.goto('/#start')
  const homeIds = new Set(
    await page.$$eval('[id]', (els) => els.map((el) => `#${el.id}`)),
  )
  const broken: string[] = []
  for (const href of [...links].sort()) {
    if (homeIds.has(href)) continue
    // Start each from a blank page, so the previous page cannot linger in the check.
    await page.goto('about:blank')
    await page.goto(`/${href}`)
    await page.locator('main, .site-shell').first().waitFor()
    // The homepage fell back in: the address names no page.
    if (await page.locator(HOME).count()) broken.push(href)
  }
  expect(broken, 'links that fall back to the homepage').toEqual([])
  expect(errors).toEqual([])
})

test('old addresses redirect and the back button returns', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'routing is the same on a phone')
  await page.goto('/#projects')
  await expect(page).toHaveURL(/#projekt$/)
  await page.goto('/#politik-debatter')
  await expect(page).toHaveURL(/#politik-sakdebatter$/)
  await page.goto('/#symbolic-atlas')
  await page.goto('/#ai-act')
  await page.goBack()
  await expect(page).toHaveURL(/#symbolic-atlas$/)
  await page.goForward()
  await expect(page).toHaveURL(/#ai-act$/)
})
