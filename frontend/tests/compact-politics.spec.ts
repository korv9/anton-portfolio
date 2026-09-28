import { test, expect } from '@playwright/test'

test('decisions and law provisions are readable without leaving the site', async ({
  page,
  context,
}) => {
  let documentAttempts = 0
  await page.route('**/politics/decisions/*/*.json', async (route) => {
    if (route.request().url().endsWith('/index.json')) return route.continue()
    return route.fulfill({
      json: {
        point: {
          proposal_text: 'Beslutets exakta lydelse.',
          source_url: 'https://data.riksdagen.se/dokument/HD01JuU41',
        },
        parties: [],
        members: [],
        citations: [],
        reservations: [],
        speech_links: [],
      },
    })
  })
  await page.route(
    'https://data.riksdagen.se/dokument/HD01JuU41/text',
    (route) => {
      documentAttempts++
      if (documentAttempts === 1)
        return route.fulfill({ status: 503, body: 'Unavailable' })
      return route.fulfill({
        contentType: 'text/xml',
        body: '<dokumentstatus><dokument><html><![CDATA[<style>.bad{color:red}</style><h1>Dokumentets rubrik</h1><p>Fullständig beslutstext.</p><script>window.untrustedExecuted=true</script><table><tr><td>Tidigare lydelse</td><td>Ny lydelse</td></tr></table>]]></html></dokument></dokumentstatus>',
      })
    },
  )
  await page.route('**/politics/laws/v1/sfs-1976-580.json', (route) =>
    route.fulfill({
      json: [
        {
          provision_id: 'p1',
          label: '1 §',
          text: 'Lagen gäller förhållandet mellan arbetsgivare och arbetstagare.',
          source_url: 'https://data.riksdagen.se/dokument/sfs-1976-580',
          source_sha256: 'test',
        },
      ],
    }),
  )
  await page.goto('/#now-decisions')
  await expect(page.locator('.decision-read')).toHaveCount(5)
  expect(documentAttempts).toBe(0)
  await page.locator('.decision-read').first().click()
  await expect(page.locator('.inline-decision blockquote')).toHaveText(
    'Beslutets exakta lydelse.',
  )
  await page.getByText('Full document · Read here', { exact: true }).click()
  await expect(page.locator('.document-reader [role="alert"]')).toContainText(
    'could not be loaded',
  )
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  const full = page.locator('.document-fulltext')
  await expect(full).toContainText('Fullständig beslutstext.')
  await expect(full.locator('td')).toHaveCount(2)
  await expect(full.locator('script, style')).toHaveCount(0)
  await expect(full).not.toContainText('dokumentstatus')
  expect(context.pages()).toHaveLength(1)
  await expect(page).toHaveURL(/#now-decisions$/)
  await page.locator('.topic-tabs a[href="#now-laws"]').click()
  await page.getByLabel('Law snapshot').selectOption('sfs-1976-580')
  await page.locator('.law-text summary').first().click()
  await expect(page.locator('.law-text .source-text')).toBeVisible()
  await expect(page.locator('.law-text .source-text')).toContainText(
    'arbetsgivare och arbetstagare',
  )
  expect(context.pages()).toHaveLength(1)
})

test('three budget views retain filters, signed bars and all source rows', async ({
  page,
}) => {
  await page.goto('/#budget-comparison')
  await expect(page.locator('[data-testid^="budget-chart-"]')).toHaveCount(1)
  const proposals = page.getByTestId('budget-chart-proposals')
  await expect(proposals.locator('.comparison-bar-row')).toHaveCount(7)
  await proposals
    .getByRole('combobox', { name: 'Areas', exact: true })
    .selectOption('27')
  await expect(proposals.locator('.comparison-bar-row')).toHaveCount(27)
  await expect(
    proposals.locator('.comparison-track .negative').first(),
  ).toBeVisible()
  await proposals
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('amount')
  await expect(proposals.locator('.comparison-track.amount')).toHaveCount(27)
  await page.locator('.topic-tabs a[href="#budget-explore"]').click()
  await expect(page.locator('[data-testid^="budget-chart-"]')).toHaveCount(1)
  const explore = page.getByTestId('budget-chart-explore')
  for (const mode of [
    'scatter',
    'difference',
    'heatmap',
    'trend',
    'correlation',
    'parties',
  ]) {
    await explore.getByLabel('Chart', { exact: true }).selectOption(mode)
    await expect(explore.locator('.single-budget-chart > *')).toHaveCount(1)
  }
  await explore.getByLabel('Chart', { exact: true }).selectOption('scatter')
  await explore.getByLabel('Party', { exact: true }).selectOption('ALL')
  await explore.getByLabel('Chart', { exact: true }).selectOption('trend')
  await expect(explore.getByLabel('Party', { exact: true })).not.toHaveValue(
    'ALL',
  )
  await expect(explore.locator('.budget-trend')).toHaveCount(1)
  await page.locator('.topic-tabs a[href="#budget-outturn"]').click()
  await expect(page.locator('[data-testid^="budget-chart-"]')).toHaveCount(1)
  const outturn = page.getByTestId('budget-chart-outturn')
  await outturn
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('amount')
  await expect(outturn.locator('.comparison-track.amount')).toHaveCount(8)
  await outturn
    .getByRole('combobox', { name: 'Areas', exact: true })
    .selectOption('27')
  await expect(outturn.locator('.comparison-bar-row')).toHaveCount(27)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
