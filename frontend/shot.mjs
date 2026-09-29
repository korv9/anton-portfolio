import { chromium } from '@playwright/test'
const [,, url, out, w, h, full] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const p = await b.newPage({ viewport: { width: +w, height: +h } })
await p.addInitScript(() => { sessionStorage.setItem('intro-seen','1'); localStorage.setItem('lang', localStorage.getItem('lang') || 'sv') })
await p.emulateMedia({ reducedMotion: 'reduce' })
await p.goto(url); await p.waitForTimeout(2500)
await p.screenshot({ path: out, fullPage: full === '1' })
console.log(await p.evaluate(() => document.documentElement.scrollHeight - innerHeight))
await b.close()
