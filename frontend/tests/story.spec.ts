import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

/**
 * #politik is one story in nine sections, each answering a question with a chart and a sentence
 * from the data. The choices (party, debate, member) live in the address.
 */
test('the politics story answers its questions in order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Swedish politics through data',
  )
  // At most four key figures, and the nine sections in order.
  await expect(page.locator('.story-hero .story-kpi')).toHaveCount(4)
  await expect(page.locator('.story-section')).toHaveCount(9)
  await expect(page.locator('.story-section h2').nth(1)).toHaveText(
    'How is the Riksdag made up?',
  )
  // Power: the seats against the majority line, and the change since the last election.
  await expect(page.locator('.story-seatbar-majority')).toBeVisible()
  await expect(page.locator('.story-diverge li')).toHaveCount(8)
  // The dividing lines: an 8 × 8 similarity matrix with its numbers, and a roll call opens.
  await expect(
    page.locator('#skiljelinjerna .story-heat tbody tr'),
  ).toHaveCount(8)
  await expect(
    page.locator('#skiljelinjerna .story-heat tbody tr').first().locator('td'),
  ).toHaveCount(8)
  const vote = page.locator('.story-votes > li').first()
  await vote.locator('button').click()
  await expect(vote.locator('.story-vote-detail li')).toHaveCount(8)
  // Every advanced measure explains itself.
  const info = page.locator('#skiljelinjerna .story-info').first()
  await info.locator('button').click()
  await expect(info.getByRole('tooltip')).toContainText(
    'the share where it was the same',
  )

  // The parties: the fingerprint follows the choice, kept in the address.
  await page
    .locator('.story-party-picker')
    .getByRole('button', { name: 'V', exact: true })
    .click()
  await expect(page).toHaveURL(/parti=V/)
  await expect(page.locator('.story-fingerprint h3')).toContainText(
    'Left Party',
  )

  // The debates: a party-leader debate chosen in the explorer, kept in the address.
  const select = page.locator('.story-select select')
  const second = await select.locator('option').nth(1).getAttribute('value')
  await select.selectOption(second!)
  await expect(page).toHaveURL(new RegExp(`debatt=${second}`))
  await expect(page.locator('.story-compare section')).toHaveCount(2)
  await expect(page.locator('.story-terms').first().locator('li')).toHaveCount(
    10,
  )

  // The members: search, choose, and see the deviation with its caveat.
  await page.getByRole('searchbox').fill('Andersson')
  await page.locator('.story-members ul button').first().click()
  await expect(page).toHaveURL(/ledamot=/)
  await expect(page.locator('.story-member')).toContainText(
    'Differs from party',
  )
  await expect(page.locator('.story-member')).toContainText(
    'not by themselves mean',
  )

  // Advanced and about the data come last.
  await expect(page.locator('#fordjupad svg g')).not.toHaveCount(0)
  await expect(page.locator('.story-pipeline li')).toHaveCount(6)
  await expect(page.locator('.story-quality')).toContainText(
    'Used in the metrics',
  )

  // The address alone restores the choices.
  await page.reload()
  await expect(page.locator('.story-fingerprint h3')).toContainText(
    'Left Party',
  )
  await expect(page.locator('.story-member h3')).toBeVisible()

  const scan = await new AxeBuilder({ page })
    .include('.story')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(scan.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual(
    [],
  )
})
