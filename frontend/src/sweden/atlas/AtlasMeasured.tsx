/**
 * A · The Measured Society: one bar per domain and decade of the SCB catalogue. Height is
 * table-years (log), lightness the finest geography in that decade. A decade with no tables is
 * a ghost box. Other catalogues (other_catalogues.json) add rows when published; until then
 * a single ghost row says which ones are planned.
 */
import { useState } from 'react'
import * as THREE from 'three'
import { AtlasPage, type KeyItem } from './AtlasPage'
import { slot, SLOTS, useSlots } from './slots'
import type { Space, Tag } from './space'

type Summary = {
  domains: { id: string; label_en: string; scb_tables: number }[]
}
type Coverage = { rows: [string, number, string, number][] }
type Other = {
  catalogues: {
    id: string
    label: string
    domains: { domain: string; decade: number; items: number }[]
  }[]
}

const GEO: Record<string, string> = {
  national: '#5a4f86',
  county: '#8a7fc0',
  municipality: '#c3b8f0',
  subarea: '#f1ecff',
}
const FINEST = ['subarea', 'municipality', 'county', 'national']
const DECADES = Array.from({ length: 13 }, (_, i) => 1900 + i * 10)

export default function AtlasMeasured() {
  const { states, loading } = useSlots([
    'measurementSummary',
    'measurementCoverage',
    'measurementOther',
  ])
  const summary = slot<Summary>(states, 'measurementSummary')
  const coverage = slot<Coverage>(states, 'measurementCoverage')
  const other = slot<Other>(states, 'measurementOther')

  const [sel, setSel] = useState<string | null>(null)
  const domains = [...(summary?.domains ?? [])].sort(
    (a, b) => b.scb_tables - a.scb_tables,
  )
  const cells = new Map<string, { n: number; geo: Set<string> }>()
  for (const [d, y, g, n] of coverage?.rows ?? []) {
    const k = `${d}|${Math.floor(y / 10) * 10}`
    const c = cells.get(k) ?? { n: 0, geo: new Set<string>() }
    c.n += n
    c.geo.add(g)
    cells.set(k, c)
  }
  const firstDecade = (id: string) =>
    DECADES.find((y) => cells.has(`${id}|${y}`))
  const late = domains
    .filter((d) => d.scb_tables > 0 && (firstDecade(d.id) ?? 0) >= 1990)
    .map((d) => d.label_en.toLowerCase())
  const empty = domains
    .filter((d) => d.scb_tables === 0)
    .map((d) => d.label_en.toLowerCase())
  const revealed =
    summary && coverage
      ? `${domains[0].label_en} has the most tables (${domains[0].scb_tables.toLocaleString('en')}). ${late.length ? `${late.join(', ').replace(/^./, (c) => c.toUpperCase())} first appear${late.length > 1 ? '' : 's'} in 1990 or later.` : ''}${empty.length ? ` No SCB table is sorted under ${empty.join(', ')}.` : ''}`
      : null

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    const rows: {
      id: string
      label: string
      tables: number | null
      other?: Other['catalogues'][number]
    }[] = [
      ...domains.map((d) => ({
        id: d.id,
        label: d.label_en.toUpperCase(),
        tables: d.scb_tables,
      })),
      ...(other?.catalogues ?? []).map((c) => ({
        id: c.id,
        label: c.label.toUpperCase(),
        tables: null,
        other: c,
      })),
    ]
    if (!other)
      rows.push({ id: '_other', label: 'OTHER CATALOGUES', tables: null })
    const U = 30
    const x = (i: number) => (i - (DECADES.length - 1) / 2) * U
    const z = (j: number) => (j - (rows.length - 1) / 2) * U
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(DECADES.length * U + 20, 2, rows.length * U + 20),
      new THREE.MeshStandardMaterial({ color: '#16151c', roughness: 1 }),
    )
    base.position.y = -1
    s.scene.add(base)
    rows.forEach((r, j) => {
      DECADES.forEach((dec, i) => {
        let n = 0
        let colour = GEO.national
        if (r.other) {
          n = r.other.domains
            .filter((d) => d.decade === dec)
            .reduce((t, d) => t + d.items, 0)
          colour = '#e3c48a'
        } else if (r.id !== '_other') {
          const c = cells.get(`${r.id}|${dec}`)
          if (c) {
            n = c.n
            colour = GEO[FINEST.find((g) => c.geo.has(g)) ?? 'national']
          }
        }
        if (!n) {
          s.ghost(
            x(i),
            0,
            z(j),
            U * 0.62,
            8,
            U * 0.62,
            r.id === '_other' ? 0.4 : 0.75,
          )
          return
        }
        const h = 4 + Math.log10(n + 1) * 24
        const dim = sel != null && sel !== r.id
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(U * 0.7, h, U * 0.7),
          new THREE.MeshStandardMaterial({
            color: colour,
            roughness: 0.75,
            transparent: dim,
            opacity: dim ? 0.18 : 1,
          }),
        )
        m.position.set(x(i), h / 2, z(j))
        s.scene.add(
          s.pickable(m, () => setSel((c) => (c === r.id ? null : r.id))),
        )
      })
      tags.push({
        at: new THREE.Vector3(x(DECADES.length - 1) + U, 0, z(j)),
        lines: [
          r.tables != null
            ? `${r.label} · ${r.tables}`
            : r.id === '_other'
              ? `${r.label} · not catalogued yet`
              : r.label,
        ],
        tone: r.tables === 0 || r.id === '_other' ? 'gap' : 'lab',
        anchor: 'left',
        head: true,
        pressed: sel === r.id,
        onClick: () => setSel((c) => (c === r.id ? null : r.id)),
      })
    })
    DECADES.forEach(
      (y, i) =>
        i % 2 === 0 &&
        tags.push({
          at: new THREE.Vector3(x(i), 0, z(rows.length - 1) + U * 1.1),
          lines: [String(y)],
        }),
    )
    return tags
  }

  const d = domains.find((x) => x.id === sel)
  const first = d && firstDecade(d.id)
  const finest = d
    ? FINEST.find((g) =>
        DECADES.some((y) => cells.get(`${d.id}|${y}`)?.geo.has(g)),
      )
    : undefined
  const info = sel ? (
    d ? (
      <>
        <span className="is-head">{d.label_en.toUpperCase()}</span>
        <span>
          {d.scb_tables.toLocaleString('en')} SCB tables · first decade{' '}
          {first ?? 'none'}
        </span>
        <span>finest geography: {finest ?? 'none'}</span>
      </>
    ) : (
      <>
        <span className="is-head">OTHER CATALOGUES</span>
        <span>Socialstyrelsen, Brå, Folkhälsomyndigheten, Kulturanalys</span>
        <span className="is-gap">not catalogued yet</span>
      </>
    )
  ) : (
    <span>Choose an area of life to light its row.</span>
  )

  const keyItems: KeyItem[] = [
    ...Object.entries(GEO)
      .reverse()
      .map(([label, colour]) => ({ label, colour })),
    { label: 'not in the catalogue', colour: '#aab6cf', dashed: true },
  ]
  return (
    <AtlasPage
      current="#sweden-atlas-a"
      kicker={
        <>
          <b>A</b> · The Measured Society
        </>
      }
      question="What does Sweden measure, and what does it overlook?"
      line="Every SCB table, sorted into areas of life and counted by the decades it covers. Taller means more table-years; lighter means a finer map."
      revealed={revealed}
      revealedFrom={SLOTS.measurementCoverage.path}
      gap="Hollow boxes mark what this catalogue does not hold. Absent here is not proof that nobody in Sweden measures it, and more tables do not mean more importance."
      keyItems={keyItems}
      foot="Source: SCB statistical database catalogue · domains assigned by a documented seed, not by SCB"
      view={{ camera: [470, 760, 660], target: [40, -10, -10], shift: -110 }}
      slots={states}
      loading={loading}
      build={build}
      rebuild={sel ?? ''}
      info={info}
    />
  )
}
