/** Embedding maps and the philosophy atlas: scatters, bubbles, box plots, slopes and stacks. */
import { useState } from 'react'
import {
  Frame,
  OTHER,
  PALETTE,
  Slicer,
  color,
  useData,
  type Post,
} from '../kit'
import { linearScale } from '../../charts/scales'
import { Kpi, Svg, fmt, uniq } from './txt-kit'

type Topics = {
  observations: number
  points: [string, number, number, number, string][]
}
type Atlas = Record<string, [string, number, number, number, number][]>
const extent = (xs: number[]) =>
  [Math.min(...xs), Math.max(...xs)] as [number, number]
const noise = 'var(--cluster-noise)'
function Scatter({
  pts,
  label,
  fill,
}: {
  pts: [number, number, string, string][]
  label: string
  fill: (i: number) => string
}) {
  const x = linearScale(extent(pts.map((p) => p[0])), [6, 394])
  const y = linearScale(extent(pts.map((p) => p[1])), [394, 6])
  return (
    <Svg w={400} h={400} label={label}>
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={x(p[0])}
          cy={y(p[1])}
          r={p[3] === noise ? 1.2 : 2}
          fill={fill(i)}
          fillOpacity={p[3] === noise ? 0.5 : 0.8}
        >
          <title>{p[2]}</title>
        </circle>
      ))}
    </Svg>
  )
}
const CORPORA = ['debate', 'philosophy', 'municipalities'] as const
const VARIANTS = ['baseline', 'author_centered'] as const
const d = 'ml'

function TopicMap() {
  const [corpus, setCorpus] = useState<(typeof CORPORA)[number]>('debate')
  const data = useData<Topics>(
    `cluster-research/${corpus === 'municipalities' ? corpus : `${corpus}-topics`}.json`,
  )
  return (
    <>
      <Slicer
        label="Corpus"
        cycles={false}
        options={CORPORA}
        value={corpus}
        onChange={setCorpus}
      />
      <Frame data={data}>
        {(d) => {
          const pts = d.points.map(
            (p) =>
              [p[1], p[2], p[4], p[3] < 0 ? noise : color(p[3])] as [
                number,
                number,
                string,
                string,
              ],
          )
          return (
            <Scatter
              pts={pts}
              label={`Embedding map of the ${corpus} corpus, coloured by cluster`}
              fill={(i) => pts[i][3]}
            />
          )
        }}
      </Frame>
    </>
  )
}
/** Every passage grey, one work's passages in the accent and named in the corner. */
function PhilAtlas() {
  const data = useData<Atlas>('philosophy/atlas.json')
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>('baseline')
  const [work, setWork] = useState('')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d[variant] ?? []
        const works = uniq(rows.map((r) => r[0].split(':')[0]))
        const pick = works.includes(work) ? work : works[0]
        // The focal work's dots are drawn last, so they sit on top.
        const order = [...rows].sort(
          (a, b) =>
            +(a[0].split(':')[0] === pick) - +(b[0].split(':')[0] === pick),
        )
        const pts = order.map(
          (r) =>
            [
              r[2],
              r[3],
              r[0],
              r[0].split(':')[0] === pick ? PALETTE[0] : OTHER,
            ] as [number, number, string, string],
        )
        return (
          <>
            <Slicer
              label="Map"
              cycles={false}
              options={VARIANTS}
              format={(v) =>
                v === 'baseline' ? 'As embedded' : 'Author style removed'
              }
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
            <p className="mean-txt-more">{pick.replace(/-/g, ' ')}</p>
            <Scatter
              pts={pts}
              label={`Philosophy passages on an embedding map, ${pick} highlighted`}
              fill={(i) => pts[i][3]}
            />
          </>
        )
      }}
    </Frame>
  )
}
function Observations() {
  const data = useData<Topics>('cluster-research/debate-topics.json')
  return (
    <Frame data={data}>
      {(d) => <Kpi value={fmt(d.observations)} unit="speech segments" />}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-topic-map',
    domain: d,
    sources: [
      'cluster-research/debate-topics.json',
      'cluster-research/municipalities.json',
      'cluster-research/philosophy-topics.json',
    ],
    render: () => <TopicMap />,
  },
  {
    id: 'txt-ml-phil-atlas',
    domain: d,
    sources: ['philosophy/atlas.json'],
    title: 'Philosophy passages placed by text similarity, one work in colour',
    note: 'Each dot is a passage; passages with similar text embeddings sit close (UMAP, two dimensions)',
    size: 'tall',
    render: () => <PhilAtlas />,
  },
  {
    id: 'txt-ml-observations',
    domain: d,
    sources: ['cluster-research/debate-topics.json'],
    render: () => <Observations />,
  },
]
