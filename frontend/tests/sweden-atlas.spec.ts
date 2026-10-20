/**
 * SWEDEN atlas: every atlas route opens with its question, lists its data slots, and draws an
 * empty slot as a named placeholder, never as sample data.
 */
import { test, expect } from './test'

const ROUTES = [
  '#sweden-atlas',
  '#sweden-atlas-a',
  '#sweden-atlas-b',
  '#sweden-atlas-c',
  '#sweden-atlas-d',
  '#sweden-atlas-e',
  '#sweden-atlas-x',
]

test('every atlas route opens with its question and its data slots', async ({
  page,
}) => {
  for (const route of ROUTES) {
    await page.goto('/' + route)
    await expect(page.locator('#sw-title')).not.toBeEmpty()
    await expect(
      page.locator('.sw-atlas-nav a[aria-current="page"]'),
    ).toHaveAttribute('href', route)
    await expect(page.locator('.sw-atlas-data summary')).toContainText(
      /\d+ of \d+ slots filled/,
    )
    await expect(page.locator('.sw-atlas-data li')).not.toHaveCount(0)
  }
})

test('an unpublished slot is listed with the file and shape it needs', async ({
  page,
}) => {
  await page.goto('/#sweden-atlas-d')
  await expect(page.locator('.sw-atlas-data summary')).not.toContainText('of 0')
  const empty = page.locator('.sw-atlas-data li.is-empty', {
    hasText: 'sweden/belonging/belonging.json',
  })
  await expect(empty).toHaveCount(1)
  await page.locator('.sw-atlas-data summary').click()
  await expect(empty.locator('code')).toContainText('rows')
})

test('without its data a finding says which file would produce it', async ({
  page,
}) => {
  await page.route('**/connections/connections.json', (r) =>
    r.fulfill({ status: 404, body: '' }),
  )
  await page.goto('/#sweden-atlas-x')
  await expect(page.locator('.sw-atlas-sec .is-pending')).toContainText(
    'sweden/connections/connections.json',
  )
  await expect(page.locator('.sw-atlas-data li.is-empty')).toHaveCount(1)
})
