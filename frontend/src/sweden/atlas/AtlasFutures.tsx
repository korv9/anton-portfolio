/**
 * E · The Imagined Future: each corpus is its own row of yearly columns, stacked by theme
 * (share of future-oriented texts using the theme). Rows are separated by a wall and never
 * pooled. A third corpus (sou.json) gets a ghost row until it is published. A year inside a
 * corpus's period without a count is a ghost column.
 */
import * as THREE from 'three'
import { AtlasPage } from './AtlasPage'
import { slot, SLOTS, useSlots } from './slots'
import type { Space, Tag } from './space'

type Theme = { id: string; label_en: string; rows: number[][] }
type Trends = {
  columns: string[]
  themes: Theme[]
  academic?: { themes: Record<string, [number, number][]> }
}
type Sou = {
  label?: string
  period?: string
  themes: Record<string, [number, number][]>
}
type Corpus = {
  name: string
  note: string
  get: ((id: string, y: number) => number | null) | null
  years: number[]
  span: [number, number]
}

const COL: Record<string, string> = {
  security: '#E07A5F',
  crisis: '#c96a52',
  technology: '#6FB3D2',
  environment: '#4f9a8b',
  career: '#C9A227',
  culture: '#a88b3a',
  collective: '#e3d8ff',
  utopia: '#c9bcf2',
  alternatives: '#9b8be0',
}
const ORDER = Object.keys(COL)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

export default function AtlasFutures() {
  const { states, loading } = useSlots(['futures', 'futuresSou'])
  const f = slot<Trends>(states, 'futures')
  const sou = slot<Sou>(states, 'futuresSou')
  const iShare = f?.columns.indexOf('future_share_using') ?? -1
  const riks = new Map(
    (f?.themes ?? []).map((t) => [
      t.id,
      new Map(t.rows.map((r) => [r[0], r[iShare]])),
    ]),
  )
  const fromPairs = (m?: Record<string, [number, number][]>) =>
    new Map(
      Object.entries(m ?? {}).map(([k, rows]) => [
        k,
        new Map(rows.map((r) => [r[0], r[1]])),
      ]),
    )
  const diva = fromPairs(f?.academic?.themes)
  const souMap = fromPairs(sou?.themes)
  const yearsOf = (m: Map<string, Map<number, number>>) =>
    [...new Set([...m.values()].flatMap((x) => [...x.keys()]))].sort()
  const labels = new Map((f?.themes ?? []).map((t) => [t.id, t.label_en]))

  const corpora: Corpus[] = [
    {
      name: 'RIKSDAG',
      note: 'speeches',
      get: f ? (id, y) => riks.get(id)?.get(y) ?? null : null,
      years: yearsOf(riks),
      span: [0, 0],
    },
    {
      name: 'DIVA',
      note: 'thesis abstracts',
      get: diva.size ? (id, y) => diva.get(id)?.get(y) ?? null : null,
      years: yearsOf(diva),
      span: [0, 0],
    },
    {
      name: 'SOU',
      note: sou
        ? (sou.label ?? 'Government Official Reports')
        : `awaiting ${SLOTS.futuresSou.path.split('/').pop()}`,
      get: sou ? (id, y) => souMap.get(id)?.get(y) ?? null : null,
      years: yearsOf(souMap),
      span: [0, 0],
    },
  ]
  for (const c of corpora)
    c.span = c.years.length ? [c.years[0], c.years[c.years.length - 1]] : [0, 0]

  const sec = [...(riks.get('security')?.entries() ?? [])]
    .sort((a, b) => a[0] - b[0])
    .map((e) => e[1])
  const divaTop = [...diva.entries()].sort(
    (a, b) => mean([...b[1].values()]) - mean([...a[1].values()]),
  )[0]
  const revealed =
    sec.length >= 10 && divaTop
      ? `In the Riksdag, ${(labels.get('security') ?? 'security').toLowerCase()} went from about ${Math.round(mean(sec.slice(0, 5)) * 100)} % to ${Math.round(mean(sec.slice(-5)) * 100)} % of future speeches (first vs last five years). In DiVA, ${(labels.get(divaTop[0]) ?? divaTop[0]).toLowerCase()} is the most common theme.`
      : null

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    const live = corpora.filter((c) => c.years.length)
    if (!live.length) return tags
    const y0 = Math.min(...live.map((c) => c.span[0]))
    const y1 = Math.max(...live.map((c) => c.span[1]))
    const U = 16
    const K = 120
    const x = (y: number) => (y - (y0 + y1) / 2) * U
    corpora.forEach((c, j) => {
      const zc = (j - 0.5) * 180 - 90
      if (!c.get) {
        s.ghost(0, 0, zc, (y1 - y0) * U, 40, 46, 0.45)
        tags.push({
          at: new THREE.Vector3(x(y1) + 20, 0, zc),
          lines: [c.name, 'Government Official Reports', c.note],
          head: true,
          tone: 'gap',
          anchor: 'left',
        })
        return
      }
      for (let y = c.span[0]; y <= c.span[1]; y++) {
        if (!c.years.includes(y)) {
          s.ghost(x(y), 0, zc, U * 0.7, 40, 46, 0.5)
          tags.push({
            at: new THREE.Vector3(x(y), 60, zc),
            lines: [`${y} · not counted`],
            tone: 'gap',
          })
          continue
        }
        let acc = 0
        for (const id of ORDER) {
          const v = c.get(id, y)
          if (v == null) continue
          const h = v * K
          if (h < 1.5) continue
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(U * 0.8, h - 0.6, 46),
            new THREE.MeshStandardMaterial({ color: COL[id], roughness: 0.6 }),
          )
          m.position.set(x(y), acc + h / 2, zc)
          acc += h
          s.scene.add(m)
        }
      }
      tags.push({
        at: new THREE.Vector3(x(y1) + 20, 0, zc),
        lines: [c.name, `${c.note} · ${c.span[0]}–${c.span[1]}`],
        head: true,
        anchor: 'left',
      })
      // A wall between this corpus and the next: separate denominators, never pooled.
      if (j < corpora.length - 1) {
        const wall = new THREE.Mesh(
          new THREE.PlaneGeometry((y1 - y0) * U + 40, 220),
          new THREE.MeshBasicMaterial({
            color: 0x8e9ab6,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        )
        wall.position.set(0, 110, zc + 90)
        s.scene.add(wall)
        s.line(
          [
            new THREE.Vector3(x(y0) - 20, 0, zc + 90),
            new THREE.Vector3(x(y1) + 20, 0, zc + 90),
          ],
          0xaab6cf,
          0.6,
          [6, 5],
        )
      }
    })
    tags.push({
      at: new THREE.Vector3(x(y0 + 3), 236, -90),
      lines: ['SEPARATE CORPORA · separate denominators · never pooled'],
      tone: 'gap',
    })
    for (const y of [y0, 2000, 2010, 2020, y1])
      tags.push({ at: new THREE.Vector3(x(y), 0, 300), lines: [String(y)] })
    return tags
  }

  return (
    <AtlasPage
      current="#sweden-atlas-e"
      kicker={
        <>
          <b>E</b> · The Imagined Future
        </>
      }
      question="Are we imagining different futures, or merely projecting the present forward?"
      line="Each corpus is kept apart, one row each. Every slice is one year of future-oriented texts, stacked by theme."
      revealed={revealed}
      revealedFrom={SLOTS.futures.path}
      gap="Counting words is not measuring imagination or opinion. The corpora differ in genre, author and period, so they are never pooled."
      keyItems={ORDER.map((id) => ({
        label: (labels.get(id) ?? id).toLowerCase(),
        colour: COL[id],
      }))}
      foot="Height: share of future-oriented texts that use each theme · a text can use several"
      view={{ camera: [-520, 480, 1180], target: [60, 50, 0], shift: -190 }}
      slots={states}
      loading={loading}
      build={build}
    />
  )
}
