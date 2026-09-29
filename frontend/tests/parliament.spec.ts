import { test, expect } from './test'

test('politics now: seats, majority, government, decisions and history', async ({
  page,
}) => {
  // The old address leads to the dashboard.
  await page.goto('/#now')
  await expect(page).toHaveURL(/#politik$/)
  await expect(
    page.getByRole('heading', { level: 1, name: /Overview/ }),
  ).toBeVisible()
  await expect(page.locator('.dash-kpi')).toHaveCount(6)
  await expect(page.locator('.dash-seat')).not.toHaveCount(0)
  await expect(page.locator('.dash-card')).toHaveCount(5)

  // The seat calculator adds up any parties against the 175-seat line.
  await page.getByRole('link', { name: 'More: Seats in the Riksdag' }).click()
  await expect(page).toHaveURL(/#now-seats$/)
  await expect(page.getByTestId('plain-summary').locator('li')).not.toHaveCount(
    0,
  )
  const sum = page.getByTestId('seat-sum')
  await expect(sum).toContainText('Click parties')
  const chips = page.locator('.seat-bar .party-chip')
  await chips.nth(0).click()
  await chips.nth(1).click()
  await expect(sum).toContainText('seats')
  await expect(page.locator('.seat-segment.chosen')).toHaveCount(2)

  // The government, with its status and the formation news, and the latest decisions.
  await page.goto('/#now-government')
  await expect(page.locator('.government-facts')).toContainText(
    'Prime minister',
  )
  await expect(
    page.getByRole('navigation', { name: 'Politics' }).getByRole('link', {
      name: /Overview/,
    }),
  ).toHaveAttribute('aria-current', 'true')
  await page.goto('/#now-decisions')
  await expect(page.locator('.decision-list > li').first()).toBeVisible()
  await expect(page.locator('.decision-list .positions').first()).toContainText(
    /Yes|No/,
  )

  // History: party record, and the agreement matrix for any session.
  await page.goto('/#now-votes')
  const record = page.locator('section[aria-labelledby="politics-record"]')
  await expect(
    record.locator('.multi-chart polyline:not(.casing)'),
  ).toHaveCount(5)
  await record.locator('select').first().selectOption('attendance_pct')
  await expect(record.locator('.multi-chart polyline').first()).toBeVisible()
  const matrix = page.getByTestId('agreement-matrix')
  await record.locator('select').nth(1).selectOption('1993/94')
  // Seven parties in 1993/94: MP was out of the Riksdag 1991-1994, NyD was in.
  await expect(matrix.locator('tbody tr')).toHaveCount(7)
  await expect(matrix).toContainText('NYD')

  // Every issue links to its own page.
  await page.goto('/#now-issues')
  await expect(page.locator('.issue-card')).toHaveCount(15)
  await page.locator('.issue-card', { hasText: 'Arbete' }).click()
  await expect(page).toHaveURL(/#issue-arbete/)
})

test('an issue page joins decisions, parties, budget, statistics and debate', async ({
  page,
}) => {
  await page.goto('/#issue-arbete')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Arbete och integration' }),
  ).toBeVisible()
  await expect(page.getByTestId('issue-summary').locator('li')).not.toHaveCount(
    0,
  )
  await expect(page.locator('.decision-list > li')).toHaveCount(5)
  await page.getByRole('button', { name: 'Show all 8 decisions' }).click()
  await expect(page.locator('.decision-list > li')).toHaveCount(8)
  await expect(
    page.locator('section[aria-labelledby="issue-parties"] tbody tr'),
  ).not.toHaveCount(0)
  await expect(
    page.locator('section[aria-labelledby="issue-budget"] polyline'),
  ).toHaveCount(1)
  await expect(
    page.locator('section[aria-labelledby="issue-welfare"] .issue-indicator'),
  ).toHaveCount(2)
  await expect(page.locator('.speech-bars li')).not.toHaveCount(0)
})
