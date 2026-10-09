import { test, expect, siteNav } from './test'

const FLAGSHIPS = [
  'Swedish politics in numbers',
  'EU AI Act Observatory',
  'The job market in job ads',
  'Symbolic Atlas',
  'How is Sweden doing?',
  'Degree project: NLP clustering of IT incidents',
]

test('the sidebar lists the work in groups and marks the page', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  const nav = await siteNav(page)
  await expect(nav.getByRole('heading')).toHaveText([
    'Experience',
    'Projects',
    'More projects',
    'Platform',
  ])
  await expect(
    nav.getByRole('link', { name: 'Symbolic Atlas' }),
  ).toHaveAttribute('aria-current', 'page')
  // The open project's own views sit under it.
  await expect(
    nav.getByRole('list', { name: 'Symbolic Atlas' }).getByRole('link'),
  ).toHaveText(['Findings', 'Experiments', 'Method'])
  await nav.getByRole('link', { name: 'How is Sweden doing?' }).click()
  await expect(page).toHaveURL(/#sweden$/)
})

test('the sidebar holds the CV and the profiles', async ({ page }) => {
  await page.goto('/#politik')
  const side = page.locator('.side')
  await siteNav(page)
  await expect(side.getByRole('link', { name: 'CV (PDF)' })).toHaveAttribute(
    'download',
    '',
  )
  await expect(side.getByRole('link', { name: 'GitHub' })).toBeVisible()
})

test("the sidebar marks the project's view, not the project, inside a project", async ({
  page,
}) => {
  await page.goto('/#politik-budget')
  const nav = await siteNav(page)
  await expect(nav.getByRole('link', { name: 'Budget' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(
    nav.getByRole('link', { name: 'Swedish politics in numbers' }),
  ).not.toHaveAttribute('aria-current', 'page')
  await page.goto('/#thesis')
  await expect(
    (await siteNav(page)).getByRole('link', { name: FLAGSHIPS[5] }),
  ).toHaveAttribute('aria-current', 'page')
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
  const nav = page.locator('.project-subnav')
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

test('the phone menu holds the whole sidebar and closes on navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#job-market')
  const nav = page.getByRole('navigation', { name: 'Site' })
  await expect(nav).toBeHidden()
  const toggle = page.getByRole('button', { name: 'Menu' })
  await toggle.click()
  await expect(nav).toBeVisible()
  await expect(
    page.locator('.side').getByRole('link', { name: 'CV (PDF)' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await expect(toggle).toBeFocused()
  await toggle.click()
  await nav.getByRole('link', { name: 'EU AI Act Observatory' }).click()
  await expect(page).toHaveURL(/#ai-act$/)
  await expect(nav).toBeHidden()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)
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
}) => {
  // The product's themes are listed under it in the site sidebar.
  await page.goto('/#jobb-trender')
  await (
    await siteNav(page)
  )
    .getByRole('link', {
      name: /What groups do the ads form|Vilka grupper bildar annonserna/,
    })
    .click()
  await expect(page).toHaveURL(/#jobb-kluster/)
  await expect(page.locator('.cluster-story')).toBeVisible()
  await expect(page.locator('.cluster-story')).toContainText('HDBSCAN')
})
