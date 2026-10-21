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
    ['#diva-lakehouse', 'engineering'],
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
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(241, 239, 231)',
    )
    await expect(page.locator('body')).toHaveCSS('font-family', /Helvetica/)
    await expect(page.locator('.site-header')).toHaveCSS(
      'background-color',
      'rgb(226, 223, 214)',
    )
    expect(
      (await page.locator('.site-header').boundingBox())!.height,
    ).toBeLessThanOrEqual(80)
  }
  await page.goto('/#start')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(244, 240, 230)',
  )
  await expect(page.locator('.home-name')).toBeVisible()
})

test('the homepage retains its name scale, placement and palette', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'checks the protected desktop composition')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#start')
  const name = page.locator('.home-name')
  await expect(name).toHaveCSS('font-size', '112px')
  await expect(name).toHaveCSS('line-height', '103.04px')
  await expect(name).toHaveCSS('color', 'rgb(47, 40, 54)')
  const bounds = (await name.boundingBox())!
  expect(bounds.x + bounds.width / 2).toBeCloseTo(720, 0)
  expect(bounds.y).toBeCloseTo(372.5, 0)
})

test('dark visualization colors stay inside the plate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#symbolic-atlas')
  const plate = page.locator('main .plate').first()
  await expect(plate).toBeVisible()
  await expect(plate).toHaveCSS('color-scheme', 'dark')
  await expect(plate).toHaveCSS('background-color', 'rgb(36, 36, 34)')
  await expect(page.locator('body')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(241, 239, 231)',
  )
})
