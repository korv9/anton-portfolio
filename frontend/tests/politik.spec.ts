import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const THEMES: [string, string][] = [
  ['#politik-valjarna', 'Which parties do voters support?'],
  ['#politik-roster', 'How often do the parties vote alike?'],
  ['#politik-budget-detalj', 'What do the parties want to spend money on?'],
  ['#politik-tal', 'What do politicians talk about?'],
]

test('every theme answers one question with one chart, a table and its sources', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const [path, question] of THEMES) {
    await page.goto(`/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(question)
    // The question shows while the data loads; count the figures once the chart is there.
    await expect(page.locator('.theme-figure')).toHaveCount(1)
    await expect(page.locator('.theme-kpis > div').first()).toBeVisible()
    const kpis = await page.locator('.theme-kpis > div').count()
    expect(kpis, path).toBeLessThanOrEqual(3)
    await expect(
      page.getByRole('heading', { name: 'What does this mean?' }),
    ).toBeVisible()
    await expect(page.locator('.theme-source-line')).toContainText('Source')
    await page.getByRole('tab', { name: 'Table' }).click()
    await expect(page.locator('.theme-table table')).toBeVisible()
    await page.getByRole('tab', { name: 'Sources' }).click()
    await expect(page.locator('.theme-sources a').first()).toBeVisible()
    await expect(page.locator('.theme-deep a').first()).toBeVisible()
  }

  expect(errors).toEqual([])
})

test('the party bar follows the reader from the story to the other pages', async ({
  page,
}) => {
  await page.goto('/#politik')
  const bar = page.getByRole('group', { name: 'Parties' })
  await expect(bar.getByRole('button', { pressed: false })).toHaveCount(8)
  await bar.getByRole('button', { name: 'Social Democrats' }).click()
  await bar.getByRole('button', { name: 'Left Party' }).click()
  await bar.getByRole('button', { name: 'Moderates' }).click()
  await expect(page).toHaveURL(/partier=S%2CV%2CM|partier=S,V,M/)
  await page
    .locator('.project-subnav')
    .getByRole('link', { name: 'Parties' })
    .click()
  await expect(page).toHaveURL(/#politik-partier\?partier=/)
  await page
    .getByRole('navigation', { name: 'Politics' })
    .getByRole('link', { name: /What voters think/ })
    .click()
  await expect(page).toHaveURL(
    /#politik-valjarna\?partier=S%2CV%2CM|#politik-valjarna\?partier=S,V,M/,
  )
  await expect(page.locator('.bars-list li')).toHaveCount(3)
  await page.getByRole('button', { name: 'Show all' }).click()
  await expect(page.locator('.bars-list li')).toHaveCount(8)
  await expect(bar.getByRole('button', { pressed: true })).toHaveCount(0)
})

test('one party chosen in the story links to its full profile', async ({
  page,
}) => {
  await page.goto('/#politik?parti=S')
  await page
    .getByRole('link', { name: /Everything about Social Democrats/ })
    .click()
  await expect(page).toHaveURL(/#politik-partier\?partier=S/)
})

test('the view builder offers valid choices and keeps them in a shareable address', async ({
  page,
}) => {
  await page.goto('/#politik-valjarna')
  // Bars by default: the latest survey, one bar per party.
  await expect(page.locator('.bars-list li')).toHaveCount(8)
  await page.getByRole('button', { name: 'Build your own view' }).click()
  const panel = page.getByRole('dialog', { name: /Build your own view/ })
  await expect(panel).toBeVisible()
  await panel.getByLabel('Election results').check()
  await panel.getByLabel('Lines: over time').check()
  await panel.getByRole('button', { name: 'Show the view' }).click()
  await expect(panel).toBeHidden()
  await expect(page).toHaveURL(/matt=val/)
  await expect(page).toHaveURL(/diagram=linje/)
  await expect(page.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  // Party letters stand at the end of each line.
  await expect(page.locator('.end-label-text')).toHaveCount(8)
  // The address alone restores the view.
  await page.reload()
  await expect(page.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  await page.getByRole('button', { name: 'Build your own view' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto('/#politik-budget-detalj?partier=V')
  await expect(page.locator('.theme-chart-title')).toContainText('Left Party')
  expect(await page.locator('.bars-list li').count()).toBeGreaterThan(20)
  await page.getByRole('button', { name: 'Build your own view' }).click()
  await page.getByLabel('One area, every party').check()
  await page.getByLabel('Per cent of the budget for the area').check()
  await page.getByRole('button', { name: 'Show the view' }).click()
  await expect(page).toHaveURL(/jamfor=omrade/)
  await expect(page.locator('.theme-chart-meta')).toContainText('Per cent')

  await page.goto('/#politik-budget-detalj?partier=S,V')
  await expect(page.locator('.theme .grouped > li').first()).toBeVisible()

  await page.goto('/#politik-roster?matt=enighet&partier=S,M')
  await expect(page.locator('.theme-chart-title')).toContainText('Party unity')
  // Over time as columns, one small chart per party.
  await expect(page.locator('.column-multiples > li')).toHaveCount(2)
})

test('the chart, table and sources switch works with the keyboard', async ({
  page,
}) => {
  await page.goto('/#politik-roster')
  const chart = page.getByRole('tab', { name: 'Chart' })
  await chart.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Table' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('tab', { name: 'Table' })).toBeFocused()
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
  for (const href of ['#data-model', '#data-catalogue'])
    await expect(page.locator(`.explore-row[href="${href}"]`)).toHaveCount(1)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('the start page opens on the name, with no intro in front of it', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Anton Ernstsson',
  )
  await expect(page.locator('.intro-screen')).toHaveCount(0)
})

test('taxes: every kind of tax, Sweden against the other countries', async ({
  page,
}) => {
  await page.goto('/#politik-skatter')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How do Sweden’s taxes compare?',
  )
  const data = await (
    await page.request.get('/data/taxes/countries.json')
  ).json()
  // One strip per kind of tax, and one row per kind in the table.
  await expect(page.locator('.tax-strip')).toHaveCount(data.types.length)
  await expect(page.locator('.tax-table tbody tr')).toHaveCount(
    data.types.length,
  )
  // The mix lists countries, not the published averages.
  await expect(page.locator('.tax-mix li.swe')).toHaveCount(1)
  await expect(page.locator('.tax-mix')).not.toContainText('OECD average')
  // Choosing a tax follows it over time, kept in the address.
  await page.getByRole('button', { name: 'Value added tax (VAT)' }).click()
  await expect(page).toHaveURL(/skatt=T_5111/)
  await expect(page.locator('.board-card h2').nth(2)).toContainText('VAT')
  await page.getByLabel('Compare with').selectOption('nordic')
  await expect(page.locator('.tax-mix li')).toHaveCount(5)
})

test('studies: the studies before the laws, each readable in depth', async ({
  page,
}) => {
  await page.goto('/#politik-utredningar')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The studies before the laws',
  )
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
  await page.getByLabel('Led to').selectOption('lag')
  await expect(page.locator('.study-chain li').first()).toBeVisible()
  await expect(page.locator('.law-chains > li').first()).toBeVisible()
})

test('the budget says whose budget it is', async ({ page }) => {
  await page.goto('/#politik-budget')
  const id = page.locator('.budget-id')
  await expect(id).toContainText('The budget for')
  await expect(id).toContainText('Proposed by')
  await expect(id).toContainText('The Riksdag adopted')
  await expect(id.locator('.budget-id-votes li')).toHaveCount(8)
})

test('issue debates: the chosen party is the object, in shares and against the others', async ({
  page,
}) => {
  await page.goto('/#politik-sakdebatter?partier=MP')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Green Party — issue debates',
  )
  await expect(page.locator('.sak .story-kpis > div')).toHaveCount(4)
  await expect(page.locator('.sak-standout-text')).toContainText('%')
  await expect(page.locator('.sak-diverge li').first()).toBeVisible()
  await expect(page.locator('.story-terms')).toHaveCount(2)
  // Period and topic live in the address.
  const filters = page.getByRole('group', { name: 'Filters' })
  await filters.getByRole('combobox', { name: 'From' }).selectOption('2024')
  await expect(page).toHaveURL(/from=2024/)
  await filters.getByRole('combobox', { name: 'Topic' }).selectOption('miljo')
  await expect(page).toHaveURL(/amne=miljo/)
  // The riksmöte explorer is closed until asked for.
  await expect(page.locator('#topplista')).toBeHidden()
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
  await expect(page.locator('.modell-ray')).toHaveCount(8)
  await page
    .locator('.modell-slicers')
    .getByRole('button', { name: 'SD' })
    .click()
  await expect(page).toHaveURL(/parti=SD/)
  await page
    .getByRole('combobox', { name: 'Committee' })
    .selectOption({ index: 1 })
  await expect(page).toHaveURL(/utskott=/)
  await expect(page.locator('.modell-cttee.is-dim').first()).toBeAttached()
})
