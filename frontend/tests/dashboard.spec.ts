import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const areas = [
  'Overview',
  'Elections & Voters',
  'Parliament & Governments',
  'Economy & Policy',
  'Debates & Legislation',
]
test(
  'five analytical areas load their data and retain one navigation',
  { tag: '@mobile' },
  async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/#politik')
    const nav = page.getByRole('navigation', {
      name: 'Political Observatory areas',
    })
    await expect(nav.getByRole('link')).toHaveText(areas)
    const targets = [
      '#opinionen svg[role=img]',
      '#opinionen svg[role=img]',
      '#prime-minister-votes tbody tr',
      '#budget-comparison .rank-bars-list',
      '#debate-topics .rank-bars-list',
    ]
    for (let i = 0; i < areas.length; i++) {
      await nav.getByRole('link', { name: areas[i], exact: true }).click()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(areas[i])
      await expect(page.locator(targets[i]).first()).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        areas[i],
      ).toBe(true)
      const result = await new AxeBuilder({ page })
        .include('.po-workspace')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(
        result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
        areas[i],
      ).toEqual([])
    }
    expect(errors).toEqual([])
  },
)

test('party selection follows the reader across areas and retained research views', async ({
  page,
}) => {
  await page.goto('/#politik')
  const picker = page.getByRole('group', { name: 'Compare parties' })
  await picker
    .getByRole('button', { name: 'Social Democrats', exact: true })
    .click()
  await picker.getByRole('button', { name: 'Moderates', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Political Observatory areas' })
    .getByRole('link', { name: 'Debates & Legislation' })
    .click()
  await expect(page).toHaveURL(/#politik-tal\?partier=S%2CM/)
  await expect(picker.getByRole('button', { pressed: true })).toHaveCount(2)
  await page
    .getByRole('navigation', { name: 'Debate readers' })
    .getByRole('link', { name: 'Leader debates and lexical comparisons' })
    .click()
  await expect(page).toHaveURL(/#politik-partiledardebatter\?partier=S%2CM/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('debates')
  await page.locator('.po-back').click()
  await expect(page).toHaveURL(/#politik-tal\?partier=S%2CM/)
})

test('party selection narrows comparison rows and the clear action restores them', async ({
  page,
}) => {
  await page.goto('/#politik')
  const picker = page.getByRole('group', { name: 'Compare parties' })
  await expect(
    page.locator('#seat-distribution .rank-bars-list li'),
  ).toHaveCount(8)
  await picker
    .getByRole('button', { name: 'Social Democrats', exact: true })
    .click()
  await expect(
    page.locator('#seat-distribution .rank-bars-list li'),
  ).toHaveCount(1)
  await expect(page.locator('#rostlikhet tbody tr')).toHaveCount(1)
  await expect(page.locator('#rostlikhet thead th')).toHaveCount(8)
  await page.getByRole('button', { name: 'All parties', exact: true }).click()
  await expect(
    page.locator('#seat-distribution .rank-bars-list li'),
  ).toHaveCount(8)
  await expect(page.locator('#rostlikhet tbody tr')).toHaveCount(8)
})
