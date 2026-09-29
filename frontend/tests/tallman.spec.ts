import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('Herr taLLMan answers with checked claims, sources and a trace', async ({
  page,
}) => {
  await page.goto('/#tallman')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Herr taLLMan',
  )
  // No Worker behind the dev server: the engine runs in the browser, without a model.
  await expect(page.locator('.tallman-engine')).toContainText('in your browser')

  await page
    .getByRole('button', {
      name: 'Hur ofta röstade SD och M lika under riksmötet 2024/25?',
    })
    .click()
  const turn = page.locator('.tallman-turn').first()
  await expect(turn.locator('.tallman-claim').first()).toBeVisible()
  await expect(turn.locator('.tallman-stats')).toContainText(
    /hämtade? · \d+ påståenden? kontroller/,
  )
  await expect(turn.locator('.tallman-certainty')).toContainText('Certainty')
  await expect(turn.locator('.tallman-claim .tallman-chip').first()).toHaveText(
    /Computed|Directly supported/,
  )
  // Every claim cites a source one click away.
  await expect(
    turn.locator('.tallman-claim .tallman-cite').first(),
  ).toHaveAttribute('href', /#politik-roster/)

  await turn.getByText('Review the answer').click()
  // The trace's table scrolls inside the card; the card never runs off the screen.
  const right = await turn.evaluate((el) => el.getBoundingClientRect().right)
  expect(right).toBeLessThanOrEqual(page.viewportSize()!.width)
  await expect(turn.locator('.tallman-trace')).toContainText(
    'dp:rost:2024/25:M-SD',
  )
  await expect(turn.locator('.tallman-trace')).toContainText('lexikal')

  // A question the data cannot answer says so instead of guessing.
  await page
    .getByLabel('Your question')
    .fill('Vilket stöd hade Piratpartiet i valet 2026?')
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const second = page.locator('.tallman-turn').first()
  await expect(second.locator('.tallman-lead')).toContainText(
    'Otillräckligt underlag',
  )
  await expect(second.locator('.tallman-certainty')).toContainText('Låg')

  const scan = await new AxeBuilder({ page }).analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
})
