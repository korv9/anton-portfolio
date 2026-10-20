/**
 * B · The Quantified Worker: per observed year, a column above the line for what workers should
 * know and do (skills) and a stack below it for who they should be (personal expectations).
 * Matches per 1,000 words, occupation mix held fixed where the archive allows. Years between
 * the first and last archive without a counted archive are ghost columns; a year added to
 * trends.json fills its ghost on the next load.
 */
import * as THREE from 'three'
import { AtlasPage } from './AtlasPage'
import { slot, SLOTS, useSlots } from './slots'
import type { Space, Tag } from './space'

type Category = {
  id: string
  family: string
  label_en: string
  rows: (number | null)[][]
}
type Trends = { columns: string[]; categories: Category[] }

const SHADES = [
  '#f2a65a',
  '#e3d8ff',
  '#c9bcf2',
  '#ad9fe0',
  '#9283c9',
  '#7a6db3',
  '#65599c',
  '#524886',
  '#433a70',
]

export default function AtlasWorker() {
  const { states, loading } = useSlots(['languageTrends'])
  const t = slot<Trends>(states, 'languageTrends')
  const col = (name: string) => t?.columns.indexOf(name) ?? -1
  const iStd = col('per_1000_words_standardised')
  const iRaw = col('per_1000_words')
  /** The standardised rate, or the raw rate where the archive cannot be standardised. */
  const rate = (c: Category, y: number) => {
    const r = c.rows.find((row) => row[0] === y)
    if (!r) return null
    return { v: (r[iStd] ?? r[iRaw]) as number, raw: r[iStd] == null }
  }
  const skills = t?.categories.filter((c) => c.family === 'skill') ?? []
  const personal = [
    ...(t?.categories.filter((c) => c.family === 'personal') ?? []),
  ]
  const years = [
    ...new Set(skills.flatMap((c) => c.rows.map((r) => r[0] as number))),
  ].sort()
  // The personal category that grew most between the first standardised year and the last.
  const std = years.filter((y) => personal.every((c) => !rate(c, y)?.raw))
  const growth = (c: Category) =>
    (rate(c, std[std.length - 1])?.v ?? 0) / (rate(c, std[0])?.v || 1)
  personal.sort((a, b) => growth(b) - growth(a))
  const top = personal[0]
  const revealed =
    t && top && std.length > 1
      ? `${top.label_en} grew most among the personal expectations: ${rate(top, std[0])!.v.toFixed(2)} per 1,000 words in ${std[0]}, ${rate(top, std[std.length - 1])!.v.toFixed(2)} in ${std[std.length - 1]}.`
      : null

  const build = (s: Space): Tag[] => {
    const tags: Tag[] = []
    if (!years.length) return tags
    const all: number[] = []
    for (let y = years[0]; y <= years[years.length - 1]; y++) all.push(y)
    const U = 30
    const K = 22
    const x = (y: number) => (all.indexOf(y) - (all.length - 1) / 2) * U
    const ends = [x(all[0]) - 40, x(all[all.length - 1]) + 40]
    s.line(
      [new THREE.Vector3(ends[0], 0, 26), new THREE.Vector3(ends[1], 0, 26)],
      0xede6d6,
      0.5,
    )
    const missing: number[] = []
    for (const y of all) {
      if (!years.includes(y)) {
        missing.push(y)
        s.ghost(x(y), -50, 0, U * 0.55, 100, 34, 0.4)
        continue
      }
      const raw = personal.some((c) => rate(c, y)?.raw)
      const up = skills.reduce((sum, c) => sum + (rate(c, y)?.v ?? 0), 0)
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(U * 0.72, up * K, 34),
        new THREE.MeshStandardMaterial({
          color: raw ? '#5b5967' : '#a19eac',
          roughness: 0.95,
          transparent: raw,
          opacity: raw ? 0.5 : 1,
        }),
      )
      m.position.set(x(y), (up * K) / 2 + 1, 0)
      s.scene.add(m)
      let acc = 1
      personal.forEach((c, j) => {
        const h = (rate(c, y)?.v ?? 0) * K
        const g = new THREE.Mesh(
          new THREE.BoxGeometry(U * 0.72, Math.max(0.1, h - 0.8), 34),
          new THREE.MeshStandardMaterial({
            color: SHADES[j % SHADES.length],
            roughness: 0.4,
            transparent: true,
            opacity: raw ? 0.35 : 0.92,
          }),
        )
        g.position.set(x(y), -acc - h / 2, 0)
        acc += h
        s.scene.add(g)
      })
      if (raw)
        tags.push({
          at: new THREE.Vector3(x(y), up * K + 20, 0),
          lines: [`${y} · raw rate`, 'no occupation field'],
          tone: 'gap',
          anchor: 'above',
        })
    }
    const last = years[years.length - 1]
    const right = x(last) + U
    tags.push({
      at: new THREE.Vector3(right, 60, 0),
      lines: [
        'KNOW AND DO',
        skills
          .map((c) => c.label_en.split(' and ').pop()!.toLowerCase())
          .join(', '),
      ],
      head: true,
      anchor: 'left',
    })
    let acc = 0
    let prev = 14
    personal.forEach((c, j) => {
      const h = (rate(c, last)?.v ?? 0) * K
      // Labels follow their slice but keep a line apart.
      const ly = Math.min(-acc - h / 2, prev - 19)
      prev = ly
      tags.push({
        at: new THREE.Vector3(right, ly, 0),
        lines: [
          (j === 0 ? 'BE · ' : '') + c.label_en.split(' and ')[0].toLowerCase(),
        ],
        anchor: 'left',
        colour: SHADES[j],
      })
      acc += h
    })
    // Runs of missing years get one label each.
    const runs: number[][] = []
    for (const y of missing) {
      const r = runs[runs.length - 1]
      if (r && r[r.length - 1] === y - 1) r.push(y)
      else runs.push([y])
    }
    for (const r of runs)
      tags.push({
        at: new THREE.Vector3((x(r[0]) + x(r[r.length - 1])) / 2, 90, 0),
        lines: [
          r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : String(r[0]),
          'no counted archive',
          'not observed, not interpolated',
        ],
        tone: 'gap',
      })
    for (const y of years)
      tags.push({ at: new THREE.Vector3(x(y), 0, 70), lines: [String(y)] })
    return tags
  }

  return (
    <AtlasPage
      current="#sweden-atlas-b"
      kicker={
        <>
          <b>B</b> · The Quantified Worker
        </>
      }
      question="What kind of person does the Swedish labour market expect workers to be?"
      line="Above the line: what workers should know and do. Below it: who they should be. Matches per 1,000 words of job-ad text, occupation mix held fixed."
      revealed={revealed}
      revealedFrom={SLOTS.languageTrends.path}
      gap="Ads are not hiring decisions or working lives. Years without a counted archive stay empty and are never filled in."
      foot="Source: JobTech historical job ads · distinct ad texts · dictionary-based NLP, validated on samples"
      view={{ camera: [-230, 110, 1200], target: [30, -20, 0], shift: -200 }}
      slots={states}
      loading={loading}
      build={build}
    />
  )
}
