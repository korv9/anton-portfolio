/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { color, Frame, PALETTE, tile, useData, type Post } from '../kit'
import { arc, squarify } from './pol-kit'

type Topic = {
  topic_id: number
  words: number
  is_unclustered: boolean
  topic_label: string
}
type Overview = {
  data: {
    imported_speeches: number
    analyzed_segments: number
    sessions: number
  }
}
type Meaning = { passed: number; total: number }

function TopicTree() {
  return (
    <Frame data={useData<{ data: Topic[] }>('debates/summary.json')}>
      {(d) => {
        const ts = d.data.filter((t) => !t.is_unclustered)
        const rects = squarify(ts, (t) => t.words, {
          x: 0,
          y: 0,
          w: 300,
          h: 300,
        })
        return (
          <svg
            viewBox="0 0 300 300"
            role="img"
            aria-label="Words per debate topic, treemap"
          >
            {rects.map((r, i) => (
              <rect
                key={r.item.topic_id}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={color(i)}
                stroke="var(--paper)"
                strokeWidth={1.5}
              >
                <title>{`${r.item.topic_label}: ${r.item.words}`}</title>
              </rect>
            ))}
          </svg>
        )
      }}
    </Frame>
  )
}

function DebateKpis() {
  return (
    <Frame data={useData<Overview>('debates/overview.json')}>
      {({ data: o }) => (
        <div className="mean-pol-grid4" style={{ gridTemplateColumns: '1fr' }}>
          {[
            [o.imported_speeches, 'speeches'],
            [o.analyzed_segments, 'segments'],
            [o.sessions, 'sessions'],
          ].map(([v, u], i) => (
            <div key={u} className="mean-pol-cell" style={tile(color(i + 2))}>
              {v.toLocaleString('sv-SE')}
              <small>{u}</small>
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}

function MeaningRing() {
  return (
    <Frame data={useData<Meaning>('politics/meaning.json')}>
      {(m) => (
        <svg viewBox="0 0 300 300" role="img" aria-label="Meaning tests passed">
          {Array.from({ length: m.total }, (_, i) => {
            const a = (i / m.total) * Math.PI * 2
            return (
              <path
                key={i}
                d={arc(
                  150,
                  150,
                  90,
                  130,
                  a + 0.04,
                  a + (Math.PI * 2) / m.total - 0.04,
                )}
                fill={i < m.passed ? PALETTE[4] : 'var(--wash)'}
              />
            )
          })}
          <text
            x={150}
            y={162}
            textAnchor="middle"
            style={{ fontSize: 36, fontWeight: 600, fill: 'var(--ink)' }}
          >
            {m.passed}/{m.total}
          </text>
        </svg>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-topic-tree',
    domain: 'politics',
    sources: ['debates/summary.json'],
    render: () => <TopicTree />,
  },
  {
    id: 'pol-debate-kpis',
    domain: 'politics',
    sources: ['debates/overview.json'],
    size: 'tall',
    render: () => <DebateKpis />,
  },
  {
    id: 'pol-meaning-ring',
    domain: 'politics',
    sources: ['politics/meaning.json'],
    render: () => <MeaningRing />,
  },
]
