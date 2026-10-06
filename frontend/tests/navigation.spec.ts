import { test, expect } from './test'

const FLAGSHIPS = [
  'Swedish politics in numbers',
  'EU AI Act Observatory',
  'The job market in job ads',
  'Symbolic Atlas',
  'How is Sweden doing?',
  'Degree project: NLP clustering of IT incidents',
]

test('the projects menu lists the flagship work and works from the keyboard', async ({
  page,
  isMobile,
}) => {
  // The phone layout folds these into the menu, tested below.
  test.skip(isMobile, 'desktop header')
  await page.goto('/#symbolic-atlas')
  const button = page
    .locator('.global-nav')
    .getByRole('button', { name: 'Projects' })
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  const panel = page.locator(`#${await button.getAttribute('aria-controls')}`)
  await expect(panel.locator('.nav-projects strong')).toHaveText(FLAGSHIPS)
  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(button).toBeFocused()
  await button.click()
  await panel.getByRole('link', { name: /How is Sweden doing/ }).click()
  await expect(page).toHaveURL(/#sweden$/)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('the CV menu offers the three role CVs', async ({ page, isMobile }) => {
  // The phone layout folds these into the menu, tested below.
  test.skip(isMobile, 'desktop header')
  await page.goto('/#politik')
  await page.locator('.global-nav').getByRole('button', { name: 'CV' }).click()
  const links = page.locator('.global-nav .nav-cvs a')
  await expect(links).toHaveCount(3)
  await expect(links.first()).toHaveAttribute('download', '')
})

test('the header marks the global section, not project views', async ({
  page,
  isMobile,
}) => {
  // The phone layout folds these into the menu, tested below.
  test.skip(isMobile, 'desktop header')
  const nav = page.locator('.global-nav')
  for (const route of ['/#symbolic-method', '/#politik-budget', '/#thesis']) {
    await page.goto(route)
    await expect(nav.getByRole('button', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  }
  await page.goto('/#erfarenhet')
  await expect(nav.getByRole('link', { name: 'Experience' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    nav.getByRole('button', { name: 'Projects' }),
  ).not.toHaveAttribute('aria-current', 'page')
})

test('a project page says where it is and leads to the neighbouring projects', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  const crumb = page.locator('.project-context')
  await expect(crumb).toContainText('Projects')
  await expect(crumb).toContainText('Symbolic Atlas')
  const pager = page.locator('.project-pager')
  await expect(pager.locator('.pager-previous')).toContainText(FLAGSHIPS[2])
  await expect(pager.locator('.pager-next')).toContainText(FLAGSHIPS[4])
  // The ends of the list have one side only.
  await page.goto('/#politik')
  await expect(page.locator('.pager-previous')).toHaveCount(0)
  await expect(page.locator('.pager-next')).toContainText(FLAGSHIPS[1])
  await page.goto('/#thesis')
  await expect(page.locator('.pager-next')).toHaveCount(0)
  await expect(page.locator('.pager-previous')).toContainText(FLAGSHIPS[4])
  // Other work has the breadcrumb but no pager.
  await page.goto('/#drugcomb')
  await expect(page.locator('.project-context')).toContainText('DrugComb')
  await expect(page.locator('.project-pager')).toHaveCount(0)
})

test('the atlas has its own navigation and section addresses', async ({
  page,
}) => {
  await page.goto('/#symbolic-method')
  const nav = page.locator('.project-nav')
  await expect(nav.getByRole('link')).toHaveText([
    'Atlas',
    'Findings',
    'Experiments',
    'Method',
  ])
  await expect(nav.getByRole('link', { name: 'Method' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page.locator('#symbolic-method')).toBeInViewport()
})

test('the phone menu holds projects, profile and CVs, and closes on navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#job-market')
  await expect(page.locator('.global-nav')).toBeHidden()
  const toggle = page.getByRole('button', { name: 'Menu' })
  await toggle.click()
  const menu = page.locator('.mobile-nav')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.nav-projects strong')).toHaveText(FLAGSHIPS)
  await expect(menu.locator('.nav-cvs a')).toHaveCount(3)
  await menu.getByRole('link', { name: 'Experience' }).click()
  await expect(page).toHaveURL(/#erfarenhet$/)
  await expect(menu).toBeHidden()
  await expect(page.locator('#erfarenhet')).toBeInViewport()
})

test('old addresses still land in the right place', async ({ page }) => {
  for (const [from, to, section] of [
    ['/#about', '#om-mig', '#om-mig'],
    ['/#contact', '#om-mig', '#om-mig'],
    ['/#work', '#projekt', '#projekt'],
    ['/#experience', '#erfarenhet', '#erfarenhet'],
  ]) {
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to}$`))
    await expect(page.locator(section)).toBeInViewport()
  }
  await page.goto('/#job-market')
  await expect(page.locator('.project-context')).toContainText(
    'The job market in job ads',
  )
})

test('the job-ad clustering is a theme of the job-market product', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the product menu is the docked sidebar on desktop')
  await page.goto('/#jobb')
  await page
    .getByRole('navigation', { name: /^(Job market|Jobbmarknad)$/ })
    .getByRole('link', {
      name: /What groups do the ads form|Vilka grupper bildar annonserna/,
    })
    .click()
  await expect(page).toHaveURL(/#jobb-kluster/)
  await expect(page.locator('#job-market-clusters')).toBeVisible()
  await expect(page.locator('#job-market-clusters')).toContainText('HDBSCAN')
})
