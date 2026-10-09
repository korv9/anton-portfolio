import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

/**
 * #politik opens on the dashboard: a header with the data's own status, three key figures, the
 * polls with a party slicer, the seats, the bar cards, how the data is built, and Fördjupning
 * with its Explorer. Every number comes from public/data.
 */
test('the politics dashboard reads its numbers from the data and keeps choices in the address', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Swedish politics in numbers',
  )
  const overview = await (
    await page.request.get('/data/politics/overview.json')
  ).json()
  await expect(page.locator('.dk-pill')).toContainText('Latest session')
  await expect(page.locator('.dk-kpi')).toHaveCount(3)
  await expect(page.locator('.dk-kpi').first()).toContainText(
    overview.parliament.issue_speeches.toLocaleString('en-GB'),
  )
  // The seats after the latest election, and a majority line from the same file.
  const elections = await (
    await page.request.get('/data/parliament/elections.json')
  ).json()
  await expect(page.locator('.dk-gauge')).toContainText(
    `A majority takes ${elections.majority} seats`,
  )
  // The main chart's party lives in the address.
  const main = page.locator('.dk-card').first()
  await main.getByLabel('Party', { exact: true }).selectOption('M')
  await expect(page).toHaveURL(/stod=M/)
  await expect(main).toContainText('Moderates')
  // How the data is built: schema, rows from the warehouse, pipeline.
  const tech = page.locator('.dk-tech')
  await expect(tech.locator('.dk-model').first()).toContainText(
    'fct_party_roll_call',
  )
  await tech.getByRole('tab', { name: 'Rows' }).click()
  await expect(tech.locator('.dk-table tbody tr')).toHaveCount(5)
  await tech.getByRole('tab', { name: 'Pipeline' }).click()
  await expect(tech.locator('.dk-steps li')).toHaveCount(4)

  // Fördjupning: the Explorer filters, searches, sorts and pages.
  const explorer = page.locator('.dk-explorer')
  await explorer.getByRole('tab', { name: 'Municipal tax' }).click()
  await expect(explorer.locator('tbody tr')).toHaveCount(25)
  await explorer.getByRole('searchbox').fill('Ale')
  await expect(explorer.locator('tbody tr').first()).toContainText('Ale')
  await explorer.getByRole('searchbox').fill('')
  await explorer.getByRole('button', { name: 'Rate, %' }).click()
  await expect(
    explorer.getByRole('columnheader', { name: /Rate/ }),
  ).toHaveAttribute('aria-sort', 'descending')
  await explorer.getByRole('button', { name: /Show 25 more/ }).click()
  await expect(explorer.locator('tbody tr')).toHaveCount(50)
  await explorer.getByRole('tab', { name: 'Party activity' }).click()
  await explorer.getByLabel('Session').selectOption({ index: 1 })
  await expect(explorer.locator('tbody tr')).toHaveCount(8)

  const scan = await new AxeBuilder({ page })
    .include('.dk')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual(
    [],
  )
})
