/**
 * Every internal link leads somewhere. The site routes on the hash, and an address the router
 * does not know falls back to the homepage without an error, so a mistyped link would look
 * like it works. This walks the links the site shows (the sidebar, homepage, projects page,
 * every project's own pages and their pagers) and opens each one: it must open
 * a page other than the homepage, or be a section of the homepage that exists, and open
 * without a script error.
 */
import { test, expect, type Page } from './test'

// Sections of the homepage a link may point at; any other address is a page of its own.
const HOME = '#start'
const START_PAGES = [
  '/#start',
  '/#drugcomb',
  '/#concept-constellation',
  '/#philosophy-atlas',
  '/#symbolic-atlas',
  '/#thesis',
  '/#cluster-visuals',
  '/#fraga-lagen',
]

const hrefs = (page: Page) =>
  page.$$eval('a[href^="#"]', (as) =>
    as.map((a) => a.getAttribute('href')!.split('?')[0]),
  )

async function linksOn(page: Page): Promise<string[]> {
  // A page draws its links as its data arrives: wait until their number stops changing.
  let count = -1
  await expect
    .poll(
      async () => {
        const now = (await hrefs(page)).length
        const settled = now === count && now > 0
        count = now
        return settled
      },
      { intervals: [400], timeout: 15_000 },
    )
    .toBe(true)
  // The sidebar's links are in the page; on a phone they sit in the closed menu.
  return hrefs(page)
}

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
  expect(links.size).toBeGreaterThan(20)
  test
    .info()
    .annotations.push({ type: 'links', description: String(links.size) })

  await page.goto('/#start')
  const homeIds = new Set(
    await page.$$eval('[id]', (els) => els.map((el) => `#${el.id}`)),
  )
  const broken: string[] = []
  const unplaced: string[] = []
  const untitled: string[] = []
  for (const href of [...links].sort()) {
    if (homeIds.has(href)) continue
    // Start each from a blank page, so the previous page cannot linger in the check.
    await page.goto('about:blank')
    await page.goto(`/${href}`)
    await page.locator('main, .site-shell').first().waitFor()
    // The homepage fell back in: the address names no page.
    if (await page.locator(HOME).count()) broken.push(href)
    // The breadcrumb names where the page sits, not just "Projects".
    const crumbs = page.locator('.project-context li')
    // The list of projects carries no breadcrumb, nor do the lab reports and their deep dives, which name the report in a link back.
    if (
      /^#(sweden|tech|symbolic-|philosophy-|concept|drugcomb|fraga-lagen)/.test(
        href,
      )
    )
      await page
        .locator('.politik-long, .tech, .sweden')
        .first()
        .waitFor({ timeout: 45_000 })
    if (
      (await crumbs.count()) < 2 &&
      !(await page.locator('.project-context [aria-current]').count()) &&
      // The Overview (#projects) is placed by the index, not a breadcrumb.
      !href.startsWith('#projects') &&
      !(await page.locator('.politik-long, .tech, .sweden').count())
    )
      unplaced.push(href)
    // The tab names the page, not just the site.
    if (!/^.+ \| Anton Ernstsson$/.test(await page.title())) untitled.push(href)
  }
  expect(untitled, 'pages without their own title').toEqual([])
  expect(unplaced, 'pages whose breadcrumb stops at Projects').toEqual([])
  expect(broken, 'links that fall back to the homepage').toEqual([])
  expect(errors).toEqual([])
})

test('old addresses redirect and the back button returns', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'routing is the same on a phone')
  for (const [from, to, section] of [
    ['/#about', '#om-mig', '#om-mig'],
    ['/#contact', '#kontakt', '#kontakt'],
    ['/#work', '#projects', '#projects'],
    ['/#experience', '#erfarenhet', '#erfarenhet'],
  ]) {
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to}$`))
    await expect(page.locator(section)).toBeInViewport()
  }
  await page.goto('/#projekt')
  await expect(page).toHaveURL(/#projects$/)
  await page.goto('/#symbolic-atlas')
  await page.goto('/#philosophy-atlas')
  await page.goBack()
  await expect(page).toHaveURL(/#symbolic-atlas$/)
  await page.goForward()
  await expect(page).toHaveURL(/#philosophy-atlas$/)
})

test('observatory addresses land on the meaning feed', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'routing is the same on a phone')
  for (const from of ['/#politik', '/#jobb-lan', '/#now']) {
    await page.goto(from)
    await expect(page).toHaveURL(/#what-does-it-even-mean$/)
  }
  await expect(page).toHaveTitle('What does it even mean? | Anton Ernstsson')
})
