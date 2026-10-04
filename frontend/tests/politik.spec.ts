import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

const THEMES: [string, string][] = [
  ['#politik', 'Who holds power right now?'],
  ['#politik-valjarna', 'Which parties do voters support?'],
  ['#politik-roster', 'How often do the parties vote alike?'],
  ['#politik-budget', 'What do the parties want to spend money on?'],
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

test('the party rail opens each party profile and marks the selected party', async ({
  page,
}) => {
  await page.goto('/#politik')
  const rail = page.getByRole('navigation', { name: 'Explore a party' })
  await expect(rail.getByRole('link')).toHaveCount(8)
  await rail.getByRole('link', { name: 'Social Democrats' }).click()
  await expect(page).toHaveURL(/#parties-s$/)
  await expect(
    page
      .getByRole('navigation', { name: 'Explore a party' })
      .getByRole('link', {
        name: 'Social Democrats',
      }),
  ).toHaveAttribute('aria-current', 'page')
})

test('the view builder offers valid choices and keeps them in a shareable address', async ({
  page,
}) => {
  await page.goto('/#politik-valjarna')
  await expect(page.locator('.multi-chart polyline:not(.casing)')).toHaveCount(
    8,
  )
  // Party letters stand at the end of each line.
  await expect(page.locator('.end-label-text')).toHaveCount(8)
  await page.getByRole('button', { name: 'Build your own view' }).click()
  const panel = page.getByRole('dialog', { name: /Build your own view/ })
  await expect(panel).toBeVisible()
  await panel.getByLabel('Election results').check()
  await panel.getByRole('button', { name: /^SD/ }).click()
  await panel.getByRole('button', { name: 'Show the view' }).click()
  await expect(panel).toBeHidden()
  await expect(page).toHaveURL(/matt=val/)
  await expect(page).toHaveURL(/partier=S%2CM%2CV/)
  await expect(page.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  await expect(page.locator('.end-label-text')).toHaveCount(7)
  // The address alone restores the view.
  await page.reload()
  await expect(page.locator('.theme-chart-title')).toHaveText(
    'Result in Riksdag elections',
  )
  await page.getByRole('button', { name: 'Build your own view' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto('/#politik-budget')
  await page.getByRole('radio', { name: /^V/ }).click()
  await expect(page).toHaveURL(/parti=V/)
  await expect(page.locator('.theme-chart-title')).toContainText('Left Party')
  expect(await page.locator('.bars-list li').count()).toBeGreaterThan(20)
  await page.getByRole('button', { name: 'Build your own view' }).click()
  await page.getByLabel('One area, every party').check()
  await page.getByLabel('Per cent of the government’s proposal').check()
  await page.getByRole('button', { name: 'Show the view' }).click()
  await expect(page).toHaveURL(/jamfor=omrade/)
  await expect(page.locator('.theme-chart-meta')).toContainText('Per cent')

  await page.goto('/#politik-roster?matt=enighet&partier=S,M')
  await expect(page.locator('.theme-chart-title')).toContainText('Party unity')
  await expect(page.locator('.end-label-text')).toHaveCount(2)
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
  for (const href of [
    '#debates',
    '#data-explorer',
    '#politics',
    '#budget-proposals',
    '#taxes',
    '#now-history',
    '#raw-data',
  ])
    await expect(page.locator(`.explore-row[href="${href}"]`)).toHaveCount(1)
  await expect(page.locator('.explore-parties a')).toHaveCount(8)
  await page.goto('/#politik-kallor')
  await expect(page.locator('.sources-block table tbody tr')).toHaveCount(6)
  for (const href of ['#raw-data', '#data-model', '#status'])
    await expect(page.locator(`.explore-row[href="${href}"]`)).toHaveCount(1)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test.describe('the freestanding name header', () => {
  test.use({ intro: true })

  test('is immediately visible on a first visit and after reload', async ({
    page,
  }) => {
    await page.goto('/')
    const intro = page.locator('.intro-screen')
    await expect(page.locator('.site-name-heading')).toContainText(
      'ANTON ERNSTSSON',
    )
    await expect(intro).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(intro).toHaveCount(0)
  })

  test('does not block a direct project link', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.intro-screen')).toHaveCount(0, {
      timeout: 4000,
    })
    await page.evaluate(() => sessionStorage.clear())
    await page.goto('/#politik-budget')
    await expect(page.locator('.intro-screen')).toHaveCount(0)
  })

  test('is immediately available with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('.site-name-heading')).toBeVisible()
    await expect(page.locator('.intro-screen')).toHaveCount(0, {
      timeout: 1500,
    })
  })
})
