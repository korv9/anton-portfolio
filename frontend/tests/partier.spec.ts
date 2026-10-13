import { test, expect } from './test'
import AxeBuilder from '@axe-core/playwright'

test(
  'the parties: a logo each, and a dashboard for the chosen party',
  { tag: '@mobile' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#politik-partier')
    const title = page
      .locator('#politik-partier')
      .getByRole('heading', { level: 1 })
    await expect(title).toHaveText('The parties')
    const logos = page
      .locator('#mandat')
      .getByRole('group', { name: 'Parties' })
      .getByRole('button')
    await expect(logos).toHaveCount(8)
    // Choosing a logo draws that party alone and opens its dashboard.
    await logos.and(page.getByTitle('Centre Party')).click()
    await expect(page).toHaveURL(/partier=C/)
    await expect(title).toHaveText('Centre Party')
    await expect(
      page.locator('#politik-partier .board-kpis .dash-kpi'),
    ).toHaveCount(5)
    await expect(page.locator('#politik-partier .board-kpis')).toContainText(
      '/ 290',
    )
    await expect(page.locator('.party-members li')).not.toHaveCount(0)
    await expect(page.locator('.party-members img')).toHaveCount(0)
    expect(
      await page
        .locator('.party-members')
        .evaluate((el) => el.getBoundingClientRect().right <= innerWidth),
    ).toBe(true)
    const profile = await (
      await page.request.get('/data/politics/parties/c.json')
    ).json()
    await expect(page.locator('.party-members a')).toHaveText(
      profile.members.map((member: { name: string }) => member.name),
    )
    expect(
      profile.members.every((member: object) => !('photo' in member)),
    ).toBe(true)
    // The seats chart follows the chosen party through every election.
    await expect(page.locator('#mandat')).toContainText('Centre Party')
    const scan = await new AxeBuilder({ page }).analyze()
    expect(scan.violations.map((v) => v.id)).toEqual([])
    // The same logo again shows every party.
    await logos.and(page.getByTitle('Centre Party')).click()
    await expect(title).toHaveText('The parties')
  },
)
