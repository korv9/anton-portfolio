import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the parties: a card each, and a dashboard for the chosen party', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik-partier')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The parties',
  )
  const cards = page.getByRole('list', { name: 'Parties' }).getByRole('link')
  await expect(cards).toHaveCount(8)
  // Choosing a card chooses the party in the party bar too, and opens its dashboard.
  await cards.filter({ hasText: 'Centre Party' }).click()
  await expect(page).toHaveURL(/partier=C/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Centre Party',
  )
  await expect(page.locator('.board-kpis .dash-kpi')).toHaveCount(5)
  await expect(page.locator('.board-kpis')).toContainText('/ 290')
  await expect(page.locator('.party-members li')).not.toHaveCount(0)
  // The seats chart follows the chosen party through every election.
  await expect(page.locator('#mandat .alluvial-readout')).toContainText(
    'Centre Party',
  )
  const scan = await new AxeBuilder({ page }).analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
  // The same card again shows every party.
  await cards.filter({ hasText: 'Centre Party' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The parties',
  )
})
