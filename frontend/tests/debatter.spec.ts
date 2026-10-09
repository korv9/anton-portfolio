import { test, expect, siteNav } from './test'
import AxeBuilder from '@axe-core/playwright'

test('the sidebar lists the politics themes, Budget among them, with the debates', async ({
  page,
}) => {
  await page.goto('/#politik-budget')
  const nav = await siteNav(page)
  const themes = nav.getByRole('list', { name: 'Swedish politics in numbers' })
  await expect(
    themes.getByRole('link', { name: 'Issue debates' }),
  ).toBeVisible()
  await expect(
    themes.getByRole('link', { name: 'Party-leader debates' }),
  ).toBeVisible()
  await expect(
    themes.getByRole('link', { name: 'What they talk about' }),
  ).toBeVisible()
  // The budget is a dashboard: key figures, columns per party, bars per area, years.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Budget')
  await expect(nav.getByRole('link', { name: 'Budget' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  // Only the figures the flow chart does not already say: who adds and who cuts most.
  await expect(page.locator('.board-kpis .dash-kpi')).toHaveCount(2)
  await expect(page.locator('.board-card')).toHaveCount(3)
  await expect(page.locator('#budgetflode')).toBeVisible()
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
    'The Riksdag: issue debates',
  )
  // The riksmöte explorer sits behind "Go deeper", under the analysis.
  await page.locator('.sak-deeper > summary').click()
  // The leaderboard carries the counts per party; the key figures say what it does not.
  await expect(page.locator('#topplista')).toBeVisible()
  await expect(page.locator('.board-kpis .dash-kpi')).toHaveCount(2)
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
  // The page ends with the next chapter of the story.
  await expect(page.locator('.politik-next-link')).toContainText(
    'What do politicians talk about',
  )
  // Who spoke when: a lane per party, the debate in three parts.
  await expect(page.locator('.timeline-lane')).toHaveCount(8)
  await expect(page.locator('.timeline-parts > li')).toHaveCount(3)
  await page.locator('.timeline-block').first().hover()
  await expect(page.locator('.timeline-detail')).toContainText('words')
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
  // Played back, the turns appear one at a time, each announced by typing dots.
  await page.getByRole('button', { name: /Play the debate/ }).click()
  await expect(page.locator('.exchanges .turn:not(.typing)')).toHaveCount(1)
  await expect(page.locator('.turn.typing')).toHaveCount(1)
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.locator('.exchanges .turn:not(.typing)')).toHaveCount(2)
  await page.getByRole('button', { name: /Show everything/ }).click()
  await expect(page.locator('.turn.typing')).toHaveCount(0)
})
