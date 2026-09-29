import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the politics sidebar has Overview, Budget and Debates with their sub-pages', async ({
  page,
  isMobile,
}) => {
  await page.goto('/#politik-budget')
  const nav = page.getByRole('navigation', { name: 'Politics' })
  if (!isMobile)
    await expect(nav.getByRole('list', { name: 'Debates' })).toBeVisible()
  const debates = nav.getByRole('list', { name: 'Debates' })
  await expect(debates.getByRole('link')).toHaveText([
    'Issue debates',
    'Party-leader debates',
    'What they talk about',
  ])
  // The budget is a dashboard: key figures, columns per party, bars per area, years.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Budget')
  await expect(nav.getByRole('link', { name: 'Budget' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.locator('.board-kpis .dash-kpi')).toHaveCount(5)
  await expect(page.locator('.board-card')).toHaveCount(4)
  await expect(page.locator('.columns svg').first()).toBeVisible()
  await expect(page.locator('.board-card .grouped > li').first()).toBeVisible()
  // The old address for the whole debate section leads to the issue debates.
  await page.goto('/#politik-debatter')
  await expect(page).toHaveURL(/#politik-sakdebatter/)
})

test('issue debates: a dashboard per riksmöte and a debate with its decision', async ({
  page,
}) => {
  // Cards rise in; the contrast check reads them at rest.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik-sakdebatter?riksmote=2025/26')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Issue debates',
  )
  await expect(page.locator('.board-kpis .dash-kpi')).toHaveCount(5)
  await expect(page.locator('.board-table tbody tr').first()).toBeVisible()
  // The party bar narrows the list to debates the party took part in.
  const before = await page.locator('.board-table tbody tr').count()
  await page
    .getByRole('group', { name: 'Parties' })
    .getByRole('button', { name: /Christian Democrats|Kristdemokraterna/ })
    .click()
  await expect(page).toHaveURL(/partier=KD/)
  // Filter by issue area.
  await page
    .getByRole('combobox', { name: 'Issue area' })
    .selectOption('rattsvasende')
  await expect(page).toHaveURL(/omrade=rattsvasende/)
  expect(await page.locator('.board-table tbody tr').count()).toBeLessThan(
    before,
  )
  const first = page.locator('.board-table tbody tr a').first()
  await first.click()
  await expect(page).toHaveURL(/#politik-debatt\?typ=sak/)
  // The debate: what it was about, and how each party voted on the report.
  await expect(page.locator('.issue-chips').first()).toBeVisible()
  await expect(page.locator('.decision-table .position').first()).toBeVisible()
  const scan = await new AxeBuilder({ page }).analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
})

test('party-leader debates: over time, who replies to whom, reply by reply', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik-partiledardebatter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Party-leader debates',
  )
  await expect(page.locator('.dash-heat')).toBeVisible()
  await expect(page.locator('.column-multiples > li')).toHaveCount(8)
  const scan = await new AxeBuilder({ page }).analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
  await page
    .getByRole('link', { name: 'Read the debate reply by reply' })
    .click()
  await expect(page).toHaveURL(/typ=partiledare/)
  // Speeches in order, each followed by its replies and answers.
  await expect(page.locator('.speech-strip li').first()).toBeVisible()
  await expect(page.locator('.exchanges > li').first()).toBeVisible()
  await expect(page.locator('.turn.replik').first()).toContainText('Reply to')
  await expect(page.locator('.turn.svar').first()).toContainText('Answers')
})
