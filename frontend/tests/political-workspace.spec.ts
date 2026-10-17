import { test, expect } from './test'
import { readFile } from 'node:fs/promises'

test(
  'formation matrix exposes recorded party splits and the 175-no rule with keyboard access',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.goto('/#politik-riksdag?statsrost=2021-11-24')
    const matrix = page.locator('#prime-minister-votes')
    await expect(matrix.locator('.po-ballots tbody tr')).toHaveCount(10)
    await expect(matrix.locator('.po-ballot-detail')).toContainText(
      '117 yes, 174 no, 57 abstain, 1 absent',
    )
    await expect(matrix.locator('.po-ballot-detail')).toContainText(
      'Approval did not produce a government',
    )
    const cell = matrix.locator('.po-ballots .po-position').first()
    await cell.focus()
    await expect(matrix.locator('.po-readout')).toContainText('2014')
    await expect(cell).toHaveAttribute('aria-label', /yes/)
    await matrix
      .getByRole('combobox', { name: 'Candidate', exact: true })
      .selectOption('Ulf Kristersson')
    await expect(matrix.locator('.po-ballots tbody tr')).toHaveCount(2)
    await page.reload()
    await expect(matrix.locator('.po-ballots tbody tr')).toHaveCount(2)
    await expect(matrix.locator('.po-ballot-detail a').first()).toHaveAttribute(
      'href',
      /^https:\/\/(www|data)\.riksdagen.se/,
    )
  },
)

test('context filters expose historical gaps without inventing issue comparisons', async ({
  page,
}) => {
  await page.goto('/#politik-riksdag?riksmote=2001%2F02&omrade=education')
  await expect(page.locator('#rostlikhet')).toContainText(
    'No comparable party counts',
  )
  await page.getByRole('button', { name: 'Reset context' }).click()
  await expect(page.locator('#rostlikhet .po-similarity tbody tr')).toHaveCount(
    8,
  )
  const cell = page.locator('#rostlikhet button').first()
  await cell.focus()
  await expect(page.locator('#rostlikhet .po-readout')).toContainText(
    'comparable votes',
  )
  await cell.click()
  await expect(page).toHaveURL(/par=/)
  await page
    .getByRole('combobox', { name: 'Government period', exact: true })
    .selectOption('kristersson')
  await expect(page).toHaveURL(/regering=kristersson/)
  await expect(page.locator('#rostlikhet .po-similarity tbody tr')).toHaveCount(
    8,
  )
})

test('a decision links its dated government, policy budgets and debate evidence', async ({
  page,
}) => {
  await page.goto('/#politik-riksdag?riksmote=2025%2F26&partier=S')
  const explorer = page.locator('#decision-explorer')
  await explorer.locator('tbody th button').first().click()
  await expect(page).toHaveURL(/rost=/)
  await expect(explorer.locator('.po-decision-detail')).toContainText(
    'Ordinary committee roll call',
  )
  await expect(
    explorer.getByRole('link', { name: /Official committee report/ }),
  ).toHaveAttribute('href', /^https:\/\//)
  const policy = explorer.getByRole('link', {
    name: /Related expenditure areas/,
  })
  await expect(policy).toHaveAttribute('href', /omrade=/)
  await policy.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Economy & Policy',
  )
  await expect(page).toHaveURL(/partier=S/)
  await expect(page).toHaveURL(/omrade=/)
  await expect(
    page.locator('#budget-comparison .rank-bars-list li').first(),
  ).toBeVisible()
})

test('survey uncertainty and election comparisons are shareable and keyboard readable', async ({
  page,
}) => {
  await page.goto('/#politik-val?partier=S,M')
  const trend = page.locator('#opinionen')
  await expect(trend.locator('svg[role=img]')).toBeVisible()
  await trend.getByLabel('Published uncertainty').uncheck()
  await expect(page).toHaveURL(/osakerhet=0/)
  await trend.locator('svg[role=img]').focus()
  await page.keyboard.press('End')
  await expect(trend.locator('.chart-tooltip')).toContainText('2026')
  await page.getByRole('button', { name: 'Seat share', exact: true }).click()
  await expect(page.locator('#election-history .seat-lines')).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Compare with', exact: true })
    .selectOption('2018')
  await expect(page).toHaveURL(/jamfor=2018/)
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Compare with', exact: true }),
  ).toHaveValue('2018')
})

test('unavailable and empty deliveries retain useful states without substitute data', async ({
  page,
}) => {
  await page.route('**/parliament/workspace/index.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  )
  await page.goto('/#politik-riksdag')
  await expect(page.getByRole('alert')).toContainText('Data unavailable')
  await expect(page.locator('#prime-minister-votes')).toHaveCount(0)
  await page.unroute('**/parliament/workspace/index.json')
  await page.goto('/#politik-riksdag?fran=2025&till=1993')
  await page.reload()
  await expect(page.locator('#decision-explorer')).toContainText(
    'No sessions match',
  )
  await expect(page.locator('#rostlikhet')).toContainText(
    'No comparable party counts',
  )
})

test('historical government selection opens a session with dated votes, and evidence can be downloaded', async ({
  page,
}) => {
  await page.goto('/#politik-riksdag?regering=persson&fran=1996&till=2006')
  await expect(
    page.locator('#decision-explorer tbody th button').first(),
  ).toBeVisible()
  await expect(page.locator('#decision-explorer .feature-lead')).toContainText(
    '2005/06',
  )
  await page
    .getByRole('link', { name: 'Sources & coverage', exact: true })
    .click()
  await expect(page.locator('.po-workspace-coverage')).toContainText(
    '2024/25, 2025/26',
  )
  const pending = page.waitForEvent('download')
  await page
    .getByRole('button', {
      name: 'Download workspace counts, ballots and provenance (JSON)',
    })
    .click()
  const download = await pending
  const data = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  expect(data.ballots).toHaveLength(10)
  expect(
    data.source_sha256['seeds/parliament/prime_minister_ballots.csv'],
  ).toMatch(/^[a-f0-9]{64}$/)
})
