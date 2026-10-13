import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const THEMES: [string, string][] = [
  ['#politik-valjarna', 'Which parties do voters support?'],
  ['#politik-roster', 'How often do the parties vote alike?'],
  ['#politik-budget-detalj', 'What do the parties want to spend money on?'],
]

test('every theme answers one question with one chart, a table and its sources', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const [path, question] of THEMES) {
    await page.goto(`/${path}`)
    // Every chapter shares one long page; the address lands on its own.
    const here = page.locator('#politik')
    await expect(here.getByRole('heading', { level: 1 })).toHaveText(question)
    // The question shows while the data loads; count the figures once the chart is there.
    await expect(here.locator('.theme-figure')).toHaveCount(1)
    await expect(here.locator('.theme-kpis')).toHaveCount(0)
    await expect(here.locator('.theme-source-line')).toContainText('Source')
    await here.getByRole('tab', { name: 'Table' }).click()
    await expect(here.locator('.theme-table table')).toBeVisible()
    await here.getByRole('tab', { name: 'Sources' }).click()
    await expect(here.locator('.theme-sources a').first()).toBeVisible()
  }

  expect(errors).toEqual([])
})

test('the view builder offers valid choices and keeps them in a shareable address', async ({
  page,
}) => {
  await page.goto('/#politik-valjarna')
  const voters = page.locator('#politik')
  // Bars by default: the latest survey, one bar per party.
  await expect(voters.locator('.dumbbell li')).toHaveCount(8)
  await voters.getByRole('button', { name: 'Build your own view' }).click()
  const panel = page.getByRole('dialog', { name: /Build your own view/ })
  await expect(panel).toBeVisible()
  await panel.getByLabel('Election results').check()
  await panel.getByLabel('Lines: over time').check()
  await panel.getByRole('button', { name: 'Show the view' }).click()
  await expect(panel).toBeHidden()
  await expect(page).toHaveURL(/matt=val/)
  await expect(page).toHaveURL(/diagram=linje/)
  await expect(voters.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  // Party letters stand at the end of each line.
  await expect(voters.locator('.end-label-text')).toHaveCount(8)
  // The address alone restores the view.
  await page.reload()
  await expect(voters.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  await voters.getByRole('button', { name: 'Build your own view' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto('/#politik-budget-detalj?partier=V')
  await expect(page.locator('.theme-chart-title')).toContainText('Left Party')
  expect(await page.locator('.rank-bars-list li').count()).toBeGreaterThan(20)
  await page.getByRole('button', { name: 'Build your own view' }).click()
  await page.getByLabel('One area, every party').check()
  await page.getByLabel('Per cent of the budget for the area').check()
  await page.getByRole('button', { name: 'Show the view' }).click()
  await expect(page).toHaveURL(/jamfor=omrade/)
  await expect(page.locator('.theme-chart-meta')).toContainText('Per cent')

  await page.goto('/#politik-budget-detalj?partier=S,V')
  await expect(page.locator('.theme .grouped > li').first()).toBeVisible()

  await page.goto('/#politik-roster?matt=enighet&partier=S,M')
  const votes = page.locator('#politik')
  await expect(votes.locator('.theme-chart-title')).toContainText('Party unity')
  // Over time as columns, one small chart per party.
  await expect(votes.locator('.column-multiples > li')).toHaveCount(2)
})

test('the chart, table and sources switch works with the keyboard', async ({
  page,
}) => {
  await page.goto('/#politik-roster')
  const votes = page.locator('#politik')
  await votes.getByRole('tab', { name: 'Chart' }).focus()
  await page.keyboard.press('ArrowRight')
  const table = votes.getByRole('tab', { name: 'Table' })
  await expect(table).toHaveAttribute('aria-selected', 'true')
  await expect(table).toBeFocused()
  await expect(page.getByTestId('agreement-matrix')).toBeVisible()
})

test('explore and sources reach every detailed view and the raw tables', async ({
  page,
}) => {
  await page.goto('/#politik-utforska')
  for (const href of ['#politik-mandat', '#politik-sok'])
    await expect(page.locator(`.explore-row[href="${href}"]`)).toHaveCount(1)
  await expect(page.locator('.explore-parties a')).toHaveCount(8)
  await page.goto('/#politik-kallor')
  await expect(page.locator('.sources-block table tbody tr')).toHaveCount(6)
  await expect(
    page.locator('a[href="#data-model"],a[href="#data-catalogue"]'),
  ).toHaveCount(0)
  const results = await new AxeBuilder({ page })
    .include('#politik-kallor')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('taxes: Sweden against the average and beside its neighbours', async ({
  page,
}) => {
  // The old taxes address opens the money tab.
  await page.goto('/#politik-skatter')
  await expect(page).toHaveURL(/#politik-budget/)
  const taxes = page.locator('.report-tab')
  const data = await (
    await page.request.get('/data/taxes/countries.json')
  ).json()
  // One row per kind of tax, Sweden beside four neighbours and the average.
  await expect(taxes.locator('.tax-table tbody tr')).toHaveCount(
    data.types.length,
  )
  await expect(taxes.locator('.tax-table thead th')).toHaveText([
    'Tax',
    'Sweden',
    'Denmark',
    'Norway',
    'Finland',
    'Germany',
    'the OECD average',
    'Difference',
    'Place',
  ])
  await expect(taxes.locator('.dumbbell li')).not.toHaveCount(0)
  await taxes.getByLabel('Compare with').selectOption('nordic')
  await expect(page).toHaveURL(/grupp=nordic/)
  await expect(taxes.locator('.tax-table thead')).toContainText(
    'the Nordic average',
  )
})

test('studies: the studies before the laws, each readable in depth', async ({
  page,
}) => {
  await page.goto('/#politik-utredningar')
  await expect(
    page.locator('#politik-utredningar').getByRole('heading', { level: 1 }),
  ).toHaveText('The studies before the laws')
  const data = await (
    await page.request.get('/data/parliament/studies.json')
  ).json()
  const sou = data.latest.filter((s: { kind: string }) => s.kind === 'sou')
  await expect(page.locator('.study-list li')).toHaveCount(
    Math.min(sou.length, 80),
  )
  // Choosing a study opens it in the reading panel, kept in the address.
  const second = page.locator('.study-list button').nth(1)
  const title = (await second.locator('b').textContent()) ?? ''
  await second.click()
  await expect(page).toHaveURL(/vald=/)
  await expect(page.locator('.study-detail h3')).toHaveText(title)
  // A study that led to a law shows the chain to the decision.
  await page
    .getByRole('combobox', { name: 'Led to', exact: true })
    .selectOption('lag')
  await expect(page.locator('.study-chain li').first()).toBeVisible()
  await expect(page.locator('.law-chains > li').first()).toBeVisible()
})

test('news: the headlines, and the week in summary with its sources', async ({
  page,
}) => {
  const news = await (
    await page.request.get('/data/parliament/news.json')
  ).json()
  const [first, second] = news.items
  // A summary as summarize_news.py writes it, citing two real headlines.
  await page.route('**/parliament/news-summaries.json', (route) =>
    route.fulfill({
      json: {
        generated_at: '2026-09-28T15:00:00+00:00',
        model: 'claude-sonnet-5-5',
        period: { from: '2026-09-21', to: '2026-09-28', days: 7 },
        items_considered: 2,
        headline: 'A week of government formation',
        summary: 'Test summary.',
        themes: [
          {
            title: 'Government formation',
            text: 'Test theme.',
            parties: first.parties.slice(0, 1),
            item_ids: [first.id, second.id],
          },
        ],
        by_party: [],
        method: 'test',
      },
    }),
  )
  await page.goto('/#politik-nyheter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Political news',
  )
  await expect(page.locator('.news-summary-headline')).toHaveText(
    'A week of government formation',
  )
  await expect(page.locator('.news-cites a')).toHaveCount(2)
  await expect(page.locator('.news-cites a').first()).toHaveAttribute(
    'href',
    first.url,
  )
  await expect(page.locator('.news-feed > li')).toHaveCount(
    Math.min(news.items.length, 60),
  )
  // A topic filters the feed and is kept in the address.
  await page.locator('.news-topics button').first().click()
  await expect(page).toHaveURL(/amne=/)
  expect(await page.locator('.news-feed > li').count()).toBeLessThan(
    Math.min(news.items.length, 60),
  )
})

test('news without a summary says how it is made', async ({ page }) => {
  await page.route('**/parliament/news-summaries.json', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.goto('/#politik-nyheter')
  await expect(page.locator('.news-summary-missing')).toContainText(
    'summarize_news.py',
  )
})

test('the model: gradient boosting per party, with party and committee slicers', async ({
  page,
}) => {
  const boost = await (
    await page.request.get('/data/politics/parliament/boost.json')
  ).json()
  await page.goto('/#politik-modell?parti=C')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Can a model learn how a party votes?',
  )
  const c = boost.parties.find((p: { party: string }) => p.party === 'C')
  await expect(page.locator('#modell')).toContainText(
    `${(c.accuracy * 100).toFixed(1)} %`,
  )
  await expect(page.locator('.modell-figure .rank-bars-list li')).toHaveCount(8)
  await page
    .locator('.modell-slicers')
    .getByRole('button', { name: 'SD' })
    .click()
  await expect(page).toHaveURL(/parti=SD/)
  await page.locator('#modell .stage-details summary').click()
  await page
    .getByRole('combobox', { name: 'Committee' })
    .selectOption({ index: 1 })
  await expect(page).toHaveURL(/utskott=/)
  await expect(page.locator('.modell-cttee.is-dim').first()).toBeAttached()
})
