#!/usr/bin/env node
/**
 * `npm audit` at moderate and above, failing on every advisory except the ones listed in ACCEPTED.
 * An accepted advisory names its reason and a review date; after that date it fails again, so an
 * exception cannot outlive its check. A package is blocked only by advisories that are not accepted.
 *
 *     node scripts/npm_audit.mjs
 */
import { execFileSync } from 'node:child_process'

const ACCEPTED = {
  // picomatch <= 4.0.7, no patched release on 2026-11-18. Only dev tooling pulls it in (vite,
  // knip via fast-glob, tinyglobby, fdir); `npm audit --omit=dev` finds nothing. The globs it
  // parses are written in this repository, not supplied by a visitor, so the ReDoS has no input.
  'GHSA-fc5q-39xc-vjpf': {
    until: '2027-01-31',
    reason: 'dev-only, repo-authored globs',
  },
}
const LEVELS = ['moderate', 'high', 'critical']

let raw
try {
  raw = execFileSync('npm', ['audit', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
} catch (error) {
  raw = error.stdout // npm audit exits 1 when it finds anything; the report is still on stdout
}
const report = JSON.parse(raw)
const today = new Date().toISOString().slice(0, 10)
const open = new Set()
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== 'object' || !LEVELS.includes(via.severity)) continue
    const id = via.url.split('/').pop()
    const ok = ACCEPTED[id]
    if (ok && today <= ok.until) continue
    open.add(
      `${id} ${via.severity} ${name}: ${via.title}${ok ? ` (accepted until ${ok.until}, expired)` : ''}`,
    )
  }
}
for (const [id, ok] of Object.entries(ACCEPTED))
  console.log(`accepted ${id} until ${ok.until}: ${ok.reason}`)
if (open.size) {
  console.error([...open.keys()].join('\n'))
  process.exit(1)
}
console.log(
  'npm audit: no advisory at moderate or above outside the accepted list',
)
