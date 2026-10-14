import { test, expect, siteNav } from './test'

test('the header groups projects and marks the active project', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  const menu = await siteNav(page)
  for (const name of ['Observatories', 'Labs', 'Engineering'])
    await expect(menu.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(
    menu.getByRole('link', { name: 'Symbol Lab', exact: true }),
  ).toHaveAttribute('aria-current', 'true')
  await menu
    .getByRole('link', { name: 'Political Observatory', exact: true })
    .click()
  await expect(page).toHaveURL(/#politik$/)
  await expect(page.locator('.project-menu')).not.toHaveAttribute('open', '')
})

test(
  'the project menu works with the keyboard and on mobile',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#thesis')
    const trigger = page.locator('.project-menu summary')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.project-menu-panel')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.project-menu-panel')).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await page.locator('.project-menu-panel a[href="#cluster-visuals"]').click()
    await expect(page).toHaveURL(/#cluster-visuals/)
  },
)

test('deep dives preserve selected occupation fields', async ({ page }) => {
  await page.goto('/#jobb')
  await page
    .getByRole('group', { name: 'Occupation fields' })
    .getByRole('button', { name: 'Data/IT', exact: true })
    .click()
  await page
    .getByRole('navigation', { name: 'Go deeper' })
    .getByRole('link', { name: /Occupations/ })
    .click()
  await expect(page).toHaveURL(/jobb-yrken\?omraden=/)
  await expect(page.locator('.theme-chart-title')).toContainText('Data/IT')
})

test('project pagers follow the groups', async ({ page }) => {
  // The labs open as reports without a pager; the engineering pages keep it.
  await page.goto('/#thesis')
  await expect(page.locator('.project-pager .pager-previous')).toContainText(
    'Drug Synergy Lab',
  )
  await page.goto('/#diva-lakehouse')
  await expect(page.locator('.project-pager .pager-previous')).toContainText(
    'Homie API',
  )
  await expect(page.locator('.project-pager .pager-next')).toHaveCount(0)
})
