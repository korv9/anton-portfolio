import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'
import {
  envelope,
  fixturePayload,
  progressFixture,
} from './fixtures/compliance'

test(
  'processing progress shows a frozen cohort and blocked coverage without legal results',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    await page.route('**/data/compliance/release.json', (route) =>
      route.fulfill({ json: { schema_version: 1, state: 'unavailable' } }),
    )
    await page.route('**/data/compliance/progress.json', (route) =>
      route.fulfill({ json: progressFixture() }),
    )
    await page.goto('/#compliance')
    const progress = page.getByRole('region', {
      name: 'Collection and review progress',
    })
    await expect(progress).toBeVisible()
    await expect(progress).toContainText(
      '100 eligible active Swedish limited companies',
    )
    await expect(progress).toContainText('blocked access')
    await expect(page.locator('.compliance')).toContainText(
      'rankings remain withheld',
    )
    await expect(page.locator('.compliance').getByRole('table')).toHaveCount(0)
    await expect(page.locator('.compliance')).not.toContainText(
      'Synthetic Fixture',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    const audit = await new AxeBuilder({ page })
      .include('.compliance')
      .analyze()
    expect(audit.violations).toEqual([])
    await page.screenshot({
      path: `tmp/compliance-completion-progress-${isMobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
    await page.route('**/data/compliance/progress.json', (route) =>
      route.fulfill({
        json: {
          ...progressFixture(),
          companies: [{ name: 'Unreviewed negative assertion' }],
        },
      }),
    )
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Awaiting verified data' }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Collection and review progress' }),
    ).toHaveCount(0)
    await expect(page.locator('.compliance')).not.toContainText(
      'Unreviewed negative assertion',
    )
  },
)

test(
  'compliance has four responsive empty pages without company mock values',
  { tag: '@mobile' },
  async ({ page, isMobile }) => {
    await page.route('**/data/compliance/release.json', (route) =>
      route.fulfill({
        json: {
          schema_version: 1,
          state: 'unavailable',
          reason: 'registry_and_approved_gold_missing',
        },
      }),
    )
    for (const path of [
      '#compliance',
      '#compliance-rankings',
      '#compliance-company',
      '#compliance-stories',
    ]) {
      await page.goto('/' + path)
      await expect(
        page.getByRole('heading', { name: 'Awaiting verified data' }),
      ).toBeVisible()
      await expect(page.locator('.compliance')).not.toContainText('Synthetic')
      await expect(page.locator('.compliance').getByRole('table')).toHaveCount(
        0,
      )
      await expect(
        page.getByRole('navigation', { name: 'Report' }).getByRole('link'),
      ).toHaveCount(4)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)
      if (path === '#compliance')
        await page.screenshot({
          path: `tmp/compliance-phase5-empty-${isMobile ? 'mobile' : 'desktop'}.png`,
          fullPage: true,
        })
    }
    const audit = await new AxeBuilder({ page })
      .include('.compliance')
      .analyze()
    expect(audit.violations).toEqual([])
  },
)

test(
  'rankings keep legal identities, status filters and monetary comparisons separate',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.route('**/data/compliance/release.json', (route) =>
      route.fulfill({ json: envelope() }),
    )
    await page.goto('/#compliance-rankings')
    await expect(page.locator('.compliance tbody tr')).toHaveCount(50)
    await expect(
      page.getByRole('combobox', { name: 'Comparison', exact: true }),
    ).toBeDisabled()
    await expect(page.locator('.compliance')).toContainText(
      'KKV-dependent and combined-source rankings are disabled',
    )
    await page
      .getByRole('combobox', { name: 'Originating authority', exact: true })
      .selectOption('Integritetsskyddsmyndigheten')
    await expect(page.locator('.compliance tbody tr').first()).toContainText(
      'Synthetic Fixture 1 AB',
    )
    await page
      .getByRole('combobox', { name: 'Legal status', exact: true })
      .selectOption('final')
    await expect(page).toHaveURL(/status=final/)
    await page
      .getByRole('combobox', { name: 'Comparison', exact: true })
      .selectOption('money')
    await page
      .getByRole('combobox', { name: 'Currency', exact: true })
      .selectOption('EUR')
    await expect(page.locator('.compliance tbody tr').first()).toContainText(
      '35,000.00 EUR',
    )
    await page
      .locator('.compliance tbody tr')
      .first()
      .locator('summary')
      .click()
    await expect(
      page
        .locator('.compliance tbody tr')
        .first()
        .getByRole('link', { name: /Integritetsskyddsmyndigheten/ }),
    ).toHaveAttribute('href', /synthetic-test-only-1/)
    await page
      .locator('.compliance tbody tr')
      .first()
      .getByRole('link', { name: 'Synthetic Fixture 1 AB', exact: true })
      .click()
    await expect(page).toHaveURL(/compliance-company/)
    await expect(
      page.getByRole('heading', {
        name: 'Synthetic Fixture 1 AB',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('.compliance-timeline')).toContainText('final')
    await expect(page.locator('.compliance-definition')).toContainText(
      '5599990001',
    )
    await expect(page.locator('.compliance')).toContainText(
      'No verified financial metadata',
    )
    const audit = await new AxeBuilder({ page })
      .include('.compliance')
      .analyze()
    expect(audit.violations).toEqual([])
  },
)

test('research exports contain structured values, provenance and exact social dimensions', async ({
  page,
}) => {
  const release = envelope()
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: release }),
  )
  await page.goto('/#compliance-stories')
  await expect(
    page.getByRole('button', { name: 'Export SVG', exact: true }),
  ).toBeEnabled()
  const svgWait = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export SVG', exact: true }).click()
  const svgDownload = await svgWait
  const svgStream = await svgDownload.createReadStream()
  const svgChunks: Buffer[] = []
  for await (const part of svgStream!) svgChunks.push(Buffer.from(part))
  const svg = Buffer.concat(svgChunks).toString('utf8')
  expect(svg).toContain('width="1200" height="1200"')
  expect(svg).toContain(release.publication.payload_sha256)
  expect(svg).toContain('Source population coverage')
  await page.getByLabel('Graphic dimensions').selectOption('1500')
  const pngWait = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click()
  const pngDownload = await pngWait
  await pngDownload.saveAs('tmp/compliance-phase5-portrait.png')
  const pngStream = await pngDownload.createReadStream()
  const pngChunks: Buffer[] = []
  for await (const part of pngStream!) pngChunks.push(Buffer.from(part))
  const png = Buffer.concat(pngChunks)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(1500)
  for (const label of ['Decision CSV', 'Chart CSV', 'Methodology Markdown']) {
    const wait = page.waitForEvent('download')
    await page.getByRole('button', { name: label, exact: true }).click()
    const download = await wait
    expect(await download.failure()).toBeNull()
  }
})

test('expired or pending review hides company findings and exports', async ({
  page,
}) => {
  await page.clock.install({ time: new Date() })
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: envelope() }),
  )
  await page.goto('/#compliance-stories')
  await expect(
    page.getByRole('button', { name: 'Export SVG', exact: true }),
  ).toBeEnabled()
  await page.clock.fastForward(2 * 86400000)
  await expect(
    page.getByRole('heading', { name: 'Publication review expired' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Export SVG', exact: true }),
  ).toHaveCount(0)
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: { ...envelope(), state: 'pending' } }),
  )
  await page.getByRole('button', { name: 'Check for reviewed release' }).click()
  await expect(
    page.getByRole('heading', { name: 'Verified release unavailable' }),
  ).toBeVisible()
})

test('invalid source schemes fail before names or evidence render', async ({
  page,
}) => {
  const payload = fixturePayload()
  payload.families[0].documents[0].source_url = 'javascript:alert(1)'
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: envelope(payload) }),
  )
  await page.goto('/#compliance-rankings')
  await expect(
    page.getByRole('heading', { name: 'Verified release unavailable' }),
  ).toBeVisible()
  await expect(page.locator('.compliance')).not.toContainText(
    'Synthetic Fixture',
  )
})

test('foreign group roots link to their own identity without receiving subsidiary outcomes', async ({
  page,
}) => {
  const data = fixturePayload()
  const parent = {
    ...data.companies[0],
    company_id: 'foreign:synthetic',
    organization_number: null,
    country_code: 'US',
    registry_number: 'synthetic-foreign-register',
    registered_legal_name: 'Synthetic Foreign Parent',
    cohort_member: false,
  }
  data.companies.push(parent)
  data.relationships.push({
    company_id: 'synthetic:1',
    related_company_id: parent.company_id,
    relationship_type: 'subsidiary_of',
    valid_from: '2020-01-01',
    valid_to: null,
    source_url: 'https://example.invalid/synthetic-relationship',
    document_hash: 'a'.repeat(64),
  })
  await page.route('**/data/compliance/release.json', (route) =>
    route.fulfill({ json: envelope(data) }),
  )
  await page.goto('/#compliance-rankings?scope=corporate_group')
  await page
    .getByRole('link', { name: 'Synthetic Foreign Parent', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic Foreign Parent',
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('.compliance-definition')).toContainText(
    'Related entity outside the cohort',
  )
  await expect(page.locator('.compliance-timeline li')).toHaveCount(0)
})
