import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test('issue debates: pick an area and a debate, and read it as a chat', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik-sakdebatter?riksmote=2025/26')
  const chapter = page.locator('#politik-sakdebatter')
  await expect(chapter.getByRole('heading', { level: 1 })).toHaveText(
    'Issue debates',
  )
  await expect(chapter.locator('.chat-turn').first()).toBeVisible()
  const first = await chapter.locator('#sak-chat-title').textContent()
  // Another debate plays from the top.
  await chapter
    .getByRole('combobox', { name: 'Debate', exact: true })
    .selectOption({ index: 1 })
  await expect(page).toHaveURL(/debatt=/)
  await expect(chapter.locator('#sak-chat-title')).not.toHaveText(first!)
  await expect(chapter.locator('.chat-turn').first()).toBeVisible()
  // The issue area narrows the debates to choose from.
  await chapter
    .getByRole('combobox', { name: 'Issue area' })
    .selectOption('rattsvasende')
  await expect(page).toHaveURL(/omrade=rattsvasende/)
  await expect(chapter.locator('.chat-turn').first()).toBeVisible()
  // A turn is cut short until the reader asks for all of it.
  const more = chapter.getByRole('button', { name: 'Read all of it' }).first()
  await more.click()
  await expect(
    chapter.getByRole('button', { name: 'Show less' }).first(),
  ).toHaveAttribute('aria-expanded', 'true')
  const scan = await new AxeBuilder({ page })
    .include('#politik-sakdebatter')
    .analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
})

test('party-leader debates: what they talked about, then the debate as a chat', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#politik-partiledardebatter')
  const chapter = page.locator('#politik-partiledardebatter')
  await expect(chapter.getByRole('heading', { level: 1 })).toHaveText(
    'Party-leader debates',
  )
  await expect(chapter.locator('.dash-heat')).toBeVisible()
  await expect(chapter.locator('.chat-turn')).toHaveCount(12)
  // A reply names the party it answers.
  await expect(
    chapter.locator('.chat-turn[data-kind="replik"]').first(),
  ).toContainText('replies to')
  await chapter.getByRole('button', { name: /Keep reading/ }).click()
  await expect(chapter.locator('.chat-turn')).toHaveCount(24)
  // Another debate plays from the top.
  await chapter
    .getByRole('combobox', { name: 'Debate', exact: true })
    .selectOption({ index: 3 })
  await expect(page).toHaveURL(/debatt=/)
  await expect(chapter.locator('.chat-turn')).toHaveCount(12)
  const scan = await new AxeBuilder({ page })
    .include('#politik-partiledardebatter')
    .analyze()
  expect(scan.violations.map((v) => v.id)).toEqual([])
})
