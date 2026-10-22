import { test, expect, siteNav } from './test'

test('the header lists projects without groups or observatories and marks the active project', async ({
  page,
}) => {
  await page.goto('/#symbolic-atlas')
  const menu = await siteNav(page)
  await expect(menu.getByRole('heading')).toHaveCount(0)
  await expect(menu.locator('ul > li')).toHaveCount(7)
  await expect(menu.locator('a[href="#thesis"]')).toHaveCount(0)
  await expect(
    menu.getByRole('link', { name: 'Symbol Lab', exact: true }),
  ).toHaveAttribute('aria-current', 'true')
  for (const href of [
    '#politik',
    '#jobb',
    '#jobb-it',
    '#wellbeing',
    '#ai-act',
    '#lagboken',
  ])
    await expect(menu.locator(`a[href="${href}"]`)).toHaveCount(0)
  await menu
    .getByRole('link', { name: 'What does it even mean?', exact: true })
    .click()
  await expect(page).toHaveURL(/#what-does-it-even-mean$/)
  // The meaning page wears the SWEDEN header instead of the site header.
  await expect(page.locator('.sw-header')).toBeVisible()
  await expect(page.locator('.site-header')).toHaveCount(0)
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
