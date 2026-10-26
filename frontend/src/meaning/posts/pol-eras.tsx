/** The Riksdag's topic eras: each era's most distinctive topic, as a topic × era grid. */
import { l } from '../../i18n'
import { cellInk, focal, Frame, seq, useData, type Post } from '../kit'
import { pct } from './pol-kit'

type Eras = {
  clusters: {
    sessions: string[]
    top_topics: [number, string, number, number][]
  }[]
  topic_shares: {
    sessions: string[]
    topics: [number, string][]
    rows: number[][]
  }
}

const ERAS = 'clusters/riksdag-eras.json'

/** A topic by its top word; a short one, such as 'eu', is an acronym. */
const word = (label: string) => {
  const w = label.split(' / ')[0]
  return w.length <= 3 ? w.toUpperCase() : w
}

/** The six eras, each with its own most over-represented topic, as rows of a topic × era grid. */
function eraGrid(d: Eras) {
  const { sessions, topics, rows } = d.topic_shares
  const col = new Map(topics.map(([id], i) => [id, i]))
  // An era with no session in the share table is left out, not shown as zero.
  const eras = d.clusters
    .map((c) => ({
      name: `${c.sessions[0]?.slice(0, 4)}–${c.sessions.at(-1)?.slice(-2)}`,
      rows: c.sessions.map((s) => rows[sessions.indexOf(s)]).filter(Boolean),
    }))
    .filter((e) => e.rows.length)
  const ids = [...new Set(d.clusters.map((c) => c.top_topics[0]?.[0]))].filter(
    (id) => col.has(id),
  )
  const label = new Map(topics.map(([id, l]) => [id, word(l)]))
  const cells = ids.map((id) =>
    eras.map(
      (e) => e.rows.reduce((a, r) => a + r[col.get(id)!], 0) / e.rows.length,
    ),
  )
  return { eras, ids, label, cells }
}

function EraHeat() {
  return (
    <Frame data={useData<Eras>(ERAS)}>
      {(d) => {
        const { eras, ids, label, cells } = eraGrid(d)
        if (!ids.length || !eras.length) return null
        const max = Math.max(...cells.flat())
        const L = 90,
          T = 22,
          W = (590 - L) / eras.length,
          H = (214 - T) / ids.length
        return (
          <svg
            viewBox="0 0 600 220"
            role="img"
            aria-label={l(
              'Share of debate words per topic in each Riksdag era',
              'Andel av debattorden per ämne i varje riksdagsepok',
            )}
          >
            <g className="mean-axis">
              {eras.map((e, j) => (
                <text
                  key={e.name}
                  x={L + W * (j + 0.5)}
                  y={T - 8}
                  textAnchor="middle"
                >
                  {e.name}
                </text>
              ))}
              {ids.map((id, i) => (
                <text
                  key={id}
                  x={L - 6}
                  y={T + H * (i + 0.5)}
                  dy="0.35em"
                  textAnchor="end"
                >
                  {label.get(id)}
                </text>
              ))}
            </g>
            {ids.map((id, i) =>
              cells[i].map((v, j) => {
                const t = v / max
                const hot = v === max
                return (
                  <g key={`${id}-${j}`}>
                    <rect
                      x={L + W * j + 1}
                      y={T + H * i + 1}
                      width={W - 2}
                      height={H - 2}
                      fill={seq(t)}
                      stroke={hot ? focal(true) : undefined}
                      strokeWidth={hot ? 2 : undefined}
                    >
                      <title>{`${label.get(id)}, ${eras[j].name}: ${pct(v * 100)}`}</title>
                    </rect>
                    <text
                      x={L + W * (j + 0.5)}
                      y={T + H * (i + 0.5)}
                      dy="0.35em"
                      textAnchor="middle"
                      className="mean-pol-t"
                      style={cellInk(t)}
                    >
                      {pct(v * 100, 0)}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-riksdag-eras-heat',
    domain: 'politics',
    sources: ['clusters/riksdag-eras.json'],
    size: 'wide',
    title: [
      'Riksdag debates cluster into six descriptive eras, each with a topic of its own',
      'Riksdagens debatter grupperar sig i sex beskrivande epoker, var och en med ett eget ämne',
    ],
    note: [
      'Share of debate words per topic, mean of each era’s sessions; the six topics that most set an era apart, of 25, by their top Swedish word. A loose grouping of 33 sessions',
      'Andel av debattorden per ämne, medel över epokens riksmöten; de sex av 25 ämnen som mest skiljer ut en epok, efter sitt vanligaste ord. En lös gruppering av 33 riksmöten',
    ],
    render: () => <EraHeat />,
  },
]
