/**
 * The site-wide checks in docs/site-goals.md: opens every product route on a desktop and a phone
 * and reports, per route, whether it is charcoal, free of "not done" wording, free of console
 * errors and failed requests, and free of sideways scroll. Run against a running site:
 *   npm run goals                       (http://127.0.0.1:5173)
 *   npm run goals -- https://antonernstsson.com
 * Exits 1 while any route fails, so it can stand as the finish line.
 */
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const ROUTES = [
  '#start',
  '#projects',
  '#jobs',
  '#sweden',
  '#sweden-matning',
  '#sweden-arbete',
  '#sweden-likhet',
  '#sweden-tillhorighet',
  '#sweden-framtid',
  '#sweden-samband',
  '#what-does-it-even-mean',
  '#fraga-lagen',
  '#cluster-visuals',
  '#projects-platform',
  '#symbolic-atlas',
  '#philosophy-atlas',
  '#concept-journey',
  '#thesis',
  '#drugcomb',
  '#homie',
  '#replik',
  '#lag-ankomst',
  '#sweden-valfard',
]
// Wording that tells a visitor the work is not finished (docs/site-goals.md, "No 'not done' signals").
const NOT_DONE = [
  /not reviewed/i,
  /\b0 reviewed\b/i,
  /\bno reviewed\b/i,
  /not published yet/i,
  /not yet explained/i,
  /could not be read/i,
  /counted so far/i,
  /\b(Cluster|Group) \d+\b/,
  /Loading…/,
]
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'phone', viewport: { width: 375, height: 812 } },
]

const browser = await chromium.launch()
const failures = []
for (const view of VIEWS) {
  const context = await browser.newContext({ viewport: view.viewport })
  for (const route of ROUTES) {
    const page = await context.newPage()
    const problems = []
    page.on('console', (m) => {
      if (m.type() === 'error')
        problems.push(`console: ${m.text().slice(0, 120)}`)
    })
    page.on('response', (r) => {
      if (r.status() >= 400)
        problems.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`)
    })
    await page.goto(`${base}/${route}`)
    // Give lazy sections and data their time; anything still loading after this counts.
    await page.waitForTimeout(5000)
    const state = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      text: document.body.innerText,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }))
    if (state.background !== 'rgb(36, 36, 34)')
      problems.push(`not charcoal (${state.background})`)
    for (const pattern of NOT_DONE) {
      const hit = state.text.match(pattern)
      if (hit) problems.push(`says "${hit[0]}"`)
    }
    if (state.overflow) problems.push('scrolls sideways')
    const verdict = problems.length ? 'FAIL' : 'ok'
    console.log(`${verdict.padEnd(4)} ${view.name.padEnd(7)} ${route}`)
    for (const p of new Set(problems)) console.log(`       ${p}`)
    if (problems.length) failures.push(`${view.name} ${route}`)
    await page.close()
  }
  await context.close()
}
await browser.close()
const total = ROUTES.length * VIEWS.length
console.log(
  `\n${total - failures.length} of ${total} route views meet the site-wide goals.`,
)
process.exitCode = failures.length ? 1 : 0
