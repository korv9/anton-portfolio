import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

/**
 * #politik reads first and explores second: the opening question is answered from the data,
 * then three questions (the situation now, where the parties differ most, what to explore
 * next). The deeper analyses and sources sit in folds; a choice in the address opens them.
 */
test('the politics story answers its questions in order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'What separates the parties in practice?',
  )
  await expect(page.locator('.story-answer')).toContainText('roll calls')
  // No key-figure grid in the hero, and three questions before the folds.
  await expect(page.locator('.story-hero .story-kpi')).toHaveCount(0)
  await expect(page.locator('.story > .story-section')).toHaveCount(3)
  await expect(page.locator('.story-section h2').first()).toHaveText(
    'What is the political situation right now?',
  )
  // The situation: the seats against the majority line, and the change since the last election.
  await expect(page.locator('.story-seatbar-majority')).toBeVisible()
  await expect(page.locator('.story-diverge li')).toHaveCount(8)
  // The major difference: one chart with its interpretation; who votes with whom is a click away.
  await expect(page.locator('#skiljelinjerna .chart-section')).toHaveCount(1)
  await expect(page.locator('#skiljelinjerna .interpretation')).toBeVisible()
  await expect(page.locator('#skiljelinjerna .story-heat')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Explore: who votes with whom' })
    .click()
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
  const info = page.locator('#vem-med-vem .story-info').first()
  await info.locator('button').click()
  await expect(info.getByRole('tooltip')).toContainText(
    'the share where it was the same',
  )
  // What to explore next: editorial links to the theme pages.
  await expect(page.locator('#utforska .story-next li')).toHaveCount(5)

  await page.getByRole('button', { name: 'More analyses' }).click()
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

  // Advanced analysis closes the analyses; sources, method and data quality have their own fold.
  await expect(page.locator('#fordjupad svg g')).not.toHaveCount(0)
  await page
    .getByRole('button', { name: 'Sources, method and data quality' })
    .click()
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
