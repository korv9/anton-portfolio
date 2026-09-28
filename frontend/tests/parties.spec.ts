import { test, expect } from '@playwright/test'

test('parties: a card per party in its colour, and each party’s own page', async ({
  page,
}) => {
  await page.goto('/#parties')
  const cards = page.getByTestId('party-cards').locator('.party-card')
  await expect(cards).toHaveCount(8)
  // Each card carries its party's colour and logo.
  const sd = cards.filter({ hasText: 'Sverigedemokraterna' })
  await expect(sd).toHaveCSS('background-color', 'rgb(221, 221, 0)')
  await expect(sd.locator('img.party-logo')).toBeVisible()

  // A card leads to the party's page, with everything on it.
  await cards.filter({ hasText: 'Socialdemokraterna' }).click()
  await expect(page).toHaveURL(/#parties-s$/)
  await expect(page.getByTestId('party-hero')).toContainText(
    'Socialdemokraterna',
  )
  await expect(page.getByTestId('party-facts').locator('li')).not.toHaveCount(0)
  await expect(
    page.getByTestId('party-governments').locator('li'),
  ).not.toHaveCount(0)
  await expect(page.getByTestId('party-pairs').locator('li')).toHaveCount(7)
  await expect(
    page.getByTestId('party-record').locator('tbody tr'),
  ).not.toHaveCount(0)
  await expect(page.getByTestId('party-tax-votes').locator('li')).toHaveCount(
    12,
  )
  await expect(
    page.getByTestId('party-issues').locator('tbody tr'),
  ).not.toHaveCount(0)

  // From one party to another through the agreement list.
  await page.getByTestId('party-pairs').getByRole('link').first().click()
  await expect(page).toHaveURL(/#parties-[a-z]+$/)
  await expect(page.getByTestId('party-hero')).not.toContainText(
    'Socialdemokraterna',
  )
})
