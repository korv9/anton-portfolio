/** The philosophy atlas: passages on an embedding map, one work in the accent. */
import { useState } from 'react'
import { Frame, OTHER, PALETTE, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Svg, uniq, usable } from './txt-kit'

type Atlas = Record<string, [string, number, number, number, number][]>
const ATLAS = 'philosophy/atlas.json'
const VARIANTS = ['baseline', 'author_centered'] as const
const MAP_NAME = {
  baseline: 'As embedded',
  author_centered: 'Author style removed',
}
const d = 'ml'
const extent = (xs: number[]) =>
  [Math.min(...xs), Math.max(...xs)] as [number, number]
const workOf = (id: string) => id.split(':')[0]

function PhilAtlas() {
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>('baseline')
  const [work, setWork] = useState('')
  // A map missing from the file is a failure, not an empty chart.
  const data = usable(useData<Atlas>(ATLAS), ATLAS, (a) => a[variant]?.length)
  return (
    <Frame data={data}>
      {(atlas) => {
        const rows = atlas[variant]
        const works = uniq(rows.map((r) => workOf(r[0])))
        const pick = works.includes(work) ? work : works[0]
        // The focal work's dots are drawn last, so they sit on top.
        const order = [...rows].sort(
          (a, b) => +(workOf(a[0]) === pick) - +(workOf(b[0]) === pick),
        )
        const x = linearScale(extent(rows.map((r) => r[2])), [6, 394])
        const y = linearScale(extent(rows.map((r) => r[3])), [394, 6])
        return (
          <>
            <Slicer
              label="Map"
              cycles={false}
              options={VARIANTS}
              format={(v) => MAP_NAME[v]}
              value={variant}
              onChange={setVariant}
            />
            <Slicer
              label="Work"
              cycles={false}
              options={works}
              value={pick}
              onChange={setWork}
            />
            <p className="mean-cap">{`${pick.replace(/-/g, ' ')} · ${MAP_NAME[variant].toLowerCase()}`}</p>
            <Svg
              w={400}
              h={400}
              label={`Philosophy passages on an embedding map, ${pick} highlighted`}
            >
              {order.map((r) => {
                const on = workOf(r[0]) === pick
                return (
                  <circle
                    key={r[0]}
                    cx={x(r[2])}
                    cy={y(r[3])}
                    r={on ? 2.4 : 1.8}
                    fill={on ? PALETTE[0] : OTHER}
                    fillOpacity={on ? 0.9 : 0.45}
                  >
                    <title>{r[0]}</title>
                  </circle>
                )
              })}
            </Svg>
          </>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-phil-atlas',
    domain: d,
    sources: ['philosophy/atlas.json'],
    size: 'tall',
    title: 'Philosophy passages placed by text similarity, one work in colour',
    note: 'Each dot is a passage; passages with similar text embeddings sit close (UMAP, two dimensions)',
    render: () => <PhilAtlas />,
  },
]
