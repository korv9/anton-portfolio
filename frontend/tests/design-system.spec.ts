import { test, expect } from './test'

test('project themes survive navigation between all workspace types', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the same theme cascade on a phone')
  test.setTimeout(120_000)
  const projects = [
    ['#symbolic-atlas', 'labs'],
    ['#philosophy-atlas', 'labs'],
    ['#concept-constellation', 'labs'],
    ['#drugcomb', 'labs'],
    ['#thesis', 'engineering'],
    ['#homie', 'engineering'],
    ['#cluster-visuals', 'tool'],
  ]
  await page.goto('/#start')
  await expect(page.locator('.home-name')).toBeVisible()
  for (const [route, workspace] of projects) {
    await page.goto(`/${route}`)
    await expect(page.locator('.site-shell')).toHaveAttribute(
      'data-workspace',
      workspace,
    )
    await expect(page.locator('main h1').first()).toBeVisible()
    // Ivory on charcoal on every page, the header included.
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(36, 36, 34)',
    )
    await expect(page.locator('body')).toHaveCSS('font-family', /Helvetica/)
    await expect(page.locator('.site-header')).toHaveCSS(
      'background-color',
      'rgb(36, 36, 34)',
    )
    expect(
      (await page.locator('.site-header').boundingBox())!.height,
    ).toBeLessThanOrEqual(80)
  }
  await page.goto('/#start')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(36, 36, 34)',
  )
  await expect(page.locator('.home-name')).toBeVisible()
})

test('the homepage keeps the signature, name scale, placement and palette', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'checks the protected desktop composition')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#start')
  const name = page.locator('.home-name')
  await expect(name).toHaveCSS('font-size', '72px')
  await expect(name).toHaveCSS('color', 'rgb(241, 239, 231)')
  const centre = await page.evaluate(
    () => document.documentElement.clientWidth / 2,
  )
  const bounds = (await name.boundingBox())!
  expect(bounds.x + bounds.width / 2).toBeCloseTo(centre, 0)
  // The signature, 440 px wide and lifted 24 px above the centre; the name overlaps it by 8 px.
  const signature = (await page.locator('.home-signature').boundingBox())!
  expect(signature.width).toBeCloseTo(440, 0)
  expect(signature.x + signature.width / 2).toBeCloseTo(centre, 0)
  expect(signature.y + signature.height / 2).toBeCloseTo(450 - 24, 0)
  expect(signature.y + signature.height - bounds.y).toBeCloseTo(8, 0)
  await expect(page.locator('.home-role')).toHaveCSS(
    'color',
    'rgb(155, 150, 140)',
  )
})

test('a dark plate reads the same tokens as the charcoal page', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#symbolic-atlas')
  const plate = page.locator('main .plate').first()
  await expect(plate).toBeVisible()
  await expect(plate).toHaveCSS('color-scheme', 'dark')
  await expect(plate).toHaveCSS('background-color', 'rgb(36, 36, 34)')
  await expect(page.locator('body')).toHaveCSS('color-scheme', 'dark')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(36, 36, 34)',
  )
})
