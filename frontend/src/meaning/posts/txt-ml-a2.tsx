/** The philosophy corpus: how long each work is, and where each sits between two poles. */
import { useState } from 'react'
import { Frame, OTHER, PALETTE, Slicer, useData, type Post } from '../kit'
import { linearScale } from '../../charts/scales'
import { niceDomain, ticksBetween } from '../axes'
import { Bars, Svg, XGrid, fmt, heading, uniq, usable } from './txt-kit'
import { l } from '../../i18n'
import { fixed } from '../../format'

type Work = {
  document_id: string
  title: string
  author: string
  year: number
  tradition: string
  passages: number
  words: number
}
type PhilSummary = {
  works: Work[]
  tensions: {
    tension_id: string
    pole_a: string
    pole_b: string
    label_en: string
    label_sv?: string
  }[]
}
type Tension = {
  tension_id: string
  document_id: string
  mean_position: number
  q1: number
  median: number
  q3: number
}
const TENSIONS = 'philosophy/tensions.json'
const SUMMARY = 'philosophy/summary.json'
const DEFAULT = 'freedom_control'
const year = (y: number) => (y < 0 ? l(`${-y} BC`, `${-y} f.Kr.`) : String(y))
/** A work's short name from its id, e.g. 'kant-groundwork' → 'Kant'. */
const who = (id: string) =>
  id.startsWith('marcus')
    ? 'Marcus Aurelius'
    : id.charAt(0).toUpperCase() + id.slice(1).split('-')[0]
const surname = (author: string) => author.split(' ').at(-1)!

const byWords = (works: Work[]) => [...works].sort((a, b) => b.words - a.words)

function WorksBubble() {
  const data = usable(
    useData<PhilSummary>(SUMMARY),
    SUMMARY,
    (d) => d.works.length,
  )
  return (
    <Frame data={data}>
      {({ works }) => (
        <Bars
          label={l(
            'Words per philosophy work, longest first',
            'Ord per filosofiskt verk, längst först',
          )}
          format={fmt}
          long
          rows={byWords(works).map((w) => ({
            key: w.document_id,
            label: `${surname(w.author)}, ${w.title} (${year(w.year)})`,
            value: w.words,
          }))}
        />
      )}
    </Frame>
  )
}

/** Median positions for one tension, highest (towards pole a) first. */
const medians = (rows: Tension[], id: string) =>
  rows.filter((t) => t.tension_id === id).sort((a, b) => b.median - a.median)

function TensionBoxes() {
  const data = usable(
    useData<{ distribution: Tension[] }>(TENSIONS),
    TENSIONS,
    (d) => d.distribution.length,
  )
  // Without pole names the chart cannot say which end is which.
  const sum = usable(
    useData<PhilSummary>(SUMMARY),
    SUMMARY,
    (d) => d.tensions.length,
  )
  const [tid, setTid] = useState(DEFAULT)
  return (
    <Frame data={data}>
      {({ distribution }) => (
        <Frame data={sum}>
          {({ tensions }) => {
            const ids = uniq(distribution.map((t) => t.tension_id))
            const id = ids.includes(tid) ? tid : ids[0]
            const poles = tensions.find((t) => t.tension_id === id)
            const rows = medians(distribution, id)
            if (!poles || !rows.length)
              return (
                <p className="mean-failed">
                  {l(
                    `No poles or positions for ${id}`,
                    `Inga poler eller positioner för ${id}`,
                  )}
                </p>
              )
            // Symmetric around zero, the point between the two poles.
            // Swedish pole names from the Swedish label, 'Frihet ↔ kontroll' (pole a first).
            const sv = poles.label_sv?.toLowerCase().split(' ↔ ')
            const poleA = l(poles.pole_a, sv?.[0] ?? poles.pole_a)
            const poleB = l(poles.pole_b, sv?.[1] ?? poles.pole_b)
            const name = (t?: PhilSummary['tensions'][number]) =>
              t && l(t.label_en, t.label_sv ?? t.label_en)
            const reach = Math.max(...rows.flatMap((t) => [-t.q1, t.q3]))
            const [, hi] = niceDomain(0, reach, 2)
            const [W, H, m, top, bottom] = [300, 470, 96, 22, 22]
            const x = linearScale([-hi, hi], [m, W - 10])
            const rh = (H - top - bottom) / Math.max(rows.length, 1)
            const cy = (i: number) => top + (i + 0.5) * rh
            return (
              <>
                <Slicer
                  label={l('Tension', 'Spänning')}
                  cycles={false}
                  options={ids}
                  format={(k) =>
                    name(tensions.find((t) => t.tension_id === k)) ?? k
                  }
                  value={id}
                  onChange={setTid}
                />
                <p className="mean-cap">{name(poles)}</p>
                <Svg
                  w={W}
                  h={H}
                  label={l(
                    `Where each work's passages sit between ${poleB} and ${poleA}`,
                    `Var varje verks stycken ligger mellan ${poleB} och ${poleA}`,
                  )}
                >
                  <XGrid
                    x={x}
                    ticks={ticksBetween(-hi, hi, 2)}
                    y0={top - 4}
                    y1={H - bottom}
                    format={(t) => (t ? fixed(t, 2) : '0')}
                  />
                  <text className="mean-txt-v" x={m} y={11}>
                    {`← ${poleB}`}
                  </text>
                  <text
                    className="mean-txt-v"
                    x={W - 10}
                    y={11}
                    textAnchor="end"
                  >
                    {`${poleA} →`}
                  </text>
                  {rows.map((t, i) => (
                    <g key={t.document_id}>
                      <text
                        className="mean-txt-t"
                        x={m - 6}
                        y={cy(i) + 3.5}
                        textAnchor="end"
                      >
                        {who(t.document_id)}
                      </text>
                      <line
                        x1={x(t.q1)}
                        x2={x(t.q3)}
                        y1={cy(i)}
                        y2={cy(i)}
                        stroke={OTHER}
                        strokeWidth={1.5}
                      />
                      <circle
                        cx={x(t.median)}
                        cy={cy(i)}
                        r={3.5}
                        fill={i === 0 ? PALETTE[0] : 'var(--mean-ink)'}
                      >
                        <title>
                          {l(
                            `${t.document_id}: median ${fixed(t.median, 3)}, middle half ${fixed(t.q1, 3)} to ${fixed(t.q3, 3)}`,
                            `${t.document_id}: median ${fixed(t.median, 3)}, mittersta hälften ${fixed(t.q1, 3)} till ${fixed(t.q3, 3)}`,
                          )}
                        </title>
                      </circle>
                    </g>
                  ))}
                </Svg>
              </>
            )
          }}
        </Frame>
      )}
    </Frame>
  )
}

const d = 'ml'
export const posts: Post[] = [
  {
    id: 'txt-ml-works-bubble',
    domain: d,
    sources: ['philosophy/summary.json'],
    title: heading(({ works }: PhilSummary) => {
      const [w] = byWords(works)
      return l(
        `${w.title} is the longest of the ${works.length} works, at ${fmt(w.words)} words`,
        `${w.title} är det längsta av de ${works.length} verken, med ${fmt(w.words)} ord`,
      )
    }),
    note: [
      'Words per work in the philosophy corpus, English editions from Project Gutenberg',
      'Ord per verk i den filosofiska korpusen, engelska utgåvor från Project Gutenberg',
    ],
    render: () => <WorksBubble />,
  },
  {
    id: 'txt-ml-tension-boxes',
    domain: d,
    sources: ['philosophy/tensions.json', 'philosophy/summary.json'],
    size: 'tall',
    // A topic, not a finding: it stays true whichever tension the slicer shows.
    title: heading(({ distribution }: { distribution: Tension[] }) => {
      const works = uniq(distribution.map((t) => t.document_id)).length
      const tensions = uniq(distribution.map((t) => t.tension_id)).length
      return works && tensions
        ? l(
            `Where ${works} works sit between the two poles of ${tensions} tensions`,
            `Var ${works} verk ligger mellan polerna i ${tensions} spänningar`,
          )
        : ''
    }),
    note: [
      "Median position of each work's passages between two anchor sentences; lines span the middle half",
      'Medianläget för varje verks stycken mellan två ankarmeningar; linjerna spänner över den mittersta hälften',
    ],
    render: () => <TensionBoxes />,
  },
]
