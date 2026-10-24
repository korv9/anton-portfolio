/** Studies, news, tax decisions, debate topics, polarization and the meaning tests. */
import { focal, Frame, OTHER, tile, useData, type Post } from '../kit'
import { Bars, int, pct } from './pol-kit'

type Topic = {
  topic_id: number
  words: number
  word_share_pct: number
  is_unclustered: boolean
  topic_label: string
}
type Summary = { data: Topic[] }
type Overview = {
  data: {
    imported_speeches: number
    analyzed_segments: number
    sessions: number
    first_date: string
    last_date: string
  }
}
type Meaning = { passed: number; total: number }

const topics = (d: Summary) =>
  d.data.filter((t) => !t.is_unclustered).sort((a, b) => b.words - a.words)

function TopicBars() {
  return (
    <Frame data={useData<Summary>('debates/summary.json')}>
      {(d) => (
        <Bars
          label="Share of debate words per topic, top 10"
          format={(v) => pct(v)}
          rows={topics(d)
            .slice(0, 10)
            .map((t, i) => ({
              key: String(t.topic_id),
              label: <span title={t.topic_label}>{t.topic_label}</span>,
              value: t.word_share_pct,
              color: focal(i === 0),
            }))}
        />
      )}
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
            [o.analyzed_segments, 'passages analysed'],
            [o.sessions, 'sessions'],
          ].map(([v, u]) => (
            <div key={u} className="mean-pol-cell" style={tile(OTHER)}>
              {int(Number(v))}
              <small>{u}</small>
            </div>
          ))}
        </div>
      )}
    </Frame>
  )
}

function MeaningKpi() {
  return (
    <Frame data={useData<Meaning>('politics/meaning.json')}>
      {(m) => (
        <div className="mean-pol-kpi">
          {m.passed} of {m.total}
          <small>test cases read as expected</small>
        </div>
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'pol-topic-tree',
    domain: 'politics',
    sources: ['debates/summary.json'],
    title: (d: Summary) => {
      const rest = d.data.find((t) => t.is_unclustered)?.word_share_pct
      const n = topics(d).length
      const head = `${Math.min(10, n)} largest of ${n} debate topics`
      return rest == null
        ? head
        : `${head}; ${Math.round(rest)} % of words fit no topic`
    },
    note: 'Share of all words in Riksdag debates, labelled by key words. Source: Riksdagen.',
    render: () => <TopicBars />,
  },
  {
    id: 'pol-debate-kpis',
    domain: 'politics',
    sources: ['debates/overview.json'],
    title: (d: Overview) =>
      d.data.first_date && d.data.last_date
        ? `Riksdag debate speeches, ${d.data.first_date.slice(0, 4)}–${d.data.last_date.slice(0, 4)}`
        : 'Riksdag debate speeches',
    note: 'Speeches read for the debate topics. Source: Riksdagen.',
    render: () => <DebateKpis />,
  },
  {
    id: 'pol-meaning-ring',
    domain: 'politics',
    sources: ['politics/meaning.json'],
    title: (m: Meaning) =>
      m.total
        ? `Rule-change reader: ${m.passed} of ${m.total} test cases read as expected`
        : 'Rule-change reader test cases',
    note: 'Each case is a law edit to be read as loosening or tightening a rule.',
    render: () => <MeaningKpi />,
  },
]
