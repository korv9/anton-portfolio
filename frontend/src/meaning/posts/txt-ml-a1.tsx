/** Embedding maps and the philosophy atlas: scatters, bubbles, box plots, slopes and stacks. */
import { useState } from 'react'
import { Frame, Slicer, color, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { Kpi, Legend, Svg, fmt, palette, uniq } from './txt-kit'

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
const HUES = ['cluster', 'work'] as const
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
function PhilAtlas() {
  const data = useData<Atlas>('philosophy/atlas.json')
  const [variant, setVariant] = useState<(typeof VARIANTS)[number]>('baseline')
  const [hue, setHue] = useState<(typeof HUES)[number]>('work')
  return (
    <Frame data={data}>
      {(d) => {
        const rows = d[variant] ?? []
        const works = palette(uniq(rows.map((r) => r[0].split(':')[0])))
        const pts = rows.map(
          (r) =>
            [
              r[2],
              r[3],
              r[0],
              hue === 'work'
                ? works.get(r[0].split(':')[0])!
                : r[4] < 0
                  ? noise
                  : color(r[4]),
            ] as [number, number, string, string],
        )
        return (
          <>
            <Slicer
              label="Map"
              cycles={false}
              options={VARIANTS}
              value={variant}
              onChange={setVariant}
            />
            <Slicer
              label="Colour"
              cycles={false}
              options={HUES}
              value={hue}
              onChange={setHue}
            />
            <Scatter
              pts={pts}
              label="Philosophy passages on an embedding map"
              fill={(i) => pts[i][3]}
            />
            {hue === 'work' && <Legend items={[...works]} />}
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
  { id: 'txt-ml-topic-map', domain: d, render: () => <TopicMap /> },
  {
    id: 'txt-ml-phil-atlas',
    domain: d,
    size: 'tall',
    render: () => <PhilAtlas />,
  },
  { id: 'txt-ml-observations', domain: d, render: () => <Observations /> },
]
