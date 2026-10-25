/**
 * Mini dashboards for the hub's platform cards: SWEDEN (library visits or the language of job
 * ads), the chart feed (AI in Riksdag speeches, by party) and Ask the law (verified answers per
 * model). Each reads its project's own published files and states one finding in its headline;
 * a chart whose file cannot be read is not drawn.
 */
import { useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { num, ok, useFile } from '../../tech/techData'
import { MiniBars, MiniLine, type LinePoint } from './MiniChart'

export const pct = (v: number, digits = 1) =>
  `${(v * 100).toFixed(digits).replace(/\.0$/, '')} %`

/** A card's chart with its finding above and its unit, period and file below. */
export function Mini(props: {
  head: string
  control?: ReactNode
  caption: string
  children: ReactNode
}) {
  return (
    <figure className="mini-card">
      <p className="mini-head">{props.head}</p>
      {props.control}
      {props.children}
      <figcaption className="mini-cap">{props.caption}</figcaption>
    </figure>
  )
}

/** Two to three options, one pressed; the card's only control. */
export function Segmented<T extends string>(props: {
  label: string
  options: [T, string][]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="mini-seg" role="group" aria-label={props.label}>
      {props.options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={id === props.value}
          onClick={() => props.onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

const ticksFor = (points: LinePoint[]) =>
  [points[0], points[points.length - 1]].map((p) => ({
    x: p.x,
    label: String(p.x),
  }))

type Change = {
  balanced_visits: { municipalities: number; totals: Record<string, number> }
}
type Trends = {
  categories: {
    id: string
    label_en: string
    label_sv: string
    rows: (number | null)[][]
  }[]
}

function Libraries() {
  const change = useFile<Change>('sweden/belonging/change.json')
  if (!ok(change)) return null
  const { municipalities, totals } = change.balanced_visits
  const points = Object.entries(totals).map(([year, v]) => ({
    x: Number(year),
    y: v / 1e6,
    label: year,
  }))
  const first = points[0]
  const last = points[points.length - 1]
  const low = points.reduce((a, b) => (b.y < a.y ? b : a))
  const m = (v: number) => `${v.toFixed(1)} M`
  const head = l(
    `Library visits fell from ${m(first.y)} in ${first.x} to ${m(low.y)} in ${low.x} and were ${m(last.y)} in ${last.x}.`,
    `Biblioteksbesöken föll från ${m(first.y)} ${first.x} till ${m(low.y)} ${low.x} och var ${m(last.y)} ${last.x}.`,
  )
  return (
    <>
      <p className="mini-head">{head}</p>
      <MiniLine
        series={[{ id: 'visits', name: 'visits', points }]}
        summary={head}
        format={m}
        ticks={ticksFor(points)}
      />
      <p className="mini-cap">
        {l(
          `Visits to public libraries per year, millions, in the ${municipalities} municipalities that report every year. sweden/belonging/change.json`,
          `Besök på folkbibliotek per år, miljoner, i de ${municipalities} kommuner som rapporterar varje år. sweden/belonging/change.json`,
        )}
      </p>
    </>
  )
}

function AdLanguage() {
  const trends = useFile<Trends>('sweden/language/trends.json')
  if (!ok(trends)) return null
  const passion = trends.categories.find((c) => c.id === 'passion')
  // The main measure: matches per 1,000 words with the occupation-field mix held fixed.
  const points = (passion?.rows ?? [])
    .filter((r) => r[8] !== null)
    .map((r) => ({ x: r[0]!, y: r[8]!, label: String(r[0]) }))
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const f = (v: number) => v.toFixed(2)
  const head = l(
    `Words of passion in job ads went from ${f(first.y)} to ${f(last.y)} per 1,000 words between ${first.x} and ${last.x}.`,
    `Ord om passion i platsannonser gick från ${f(first.y)} till ${f(last.y)} per 1 000 ord mellan ${first.x} och ${last.x}.`,
  )
  return (
    <>
      <p className="mini-head">{head}</p>
      <MiniLine
        series={[{ id: 'passion', name: 'passion', points }]}
        summary={head}
        format={f}
        ticks={ticksFor(points)}
      />
      <p className="mini-cap">
        {l(
          'Matches of “passion and enthusiasm” per 1,000 words of distinct ad text, occupation-field mix held fixed, per year. sweden/language/trends.json',
          'Träffar för ”passion och entusiasm” per 1 000 ord unik annonstext, med yrkesfältens mix fast, per år. sweden/language/trends.json',
        )}
      </p>
    </>
  )
}

export function SwedenChart() {
  const [study, setStudy] = useState<'libraries' | 'language'>('libraries')
  return (
    <figure className="mini-card">
      <Segmented
        label={l('Study', 'Studie')}
        options={[
          ['libraries', l('Libraries', 'Bibliotek')],
          ['language', l('Ad language', 'Annonsspråk')],
        ]}
        value={study}
        onChange={setStudy}
      />
      {study === 'libraries' ? <Libraries /> : <AdLanguage />}
    </figure>
  )
}

type PartyYear = {
  party: string
  year: number
  speeches: number
  ai_speeches: number
}

export function FeedChart() {
  const rows = useFile<PartyYear[]>('ai-act/politics/party-year.json')
  const summary = useFile<{ last_date: string }>('ai-act/politics/summary.json')
  const [party, setParty] = useState('all')
  if (!ok(rows) || !rows.length) return null
  const years = [...new Set(rows.map((r) => r.year))].sort()
  const share = (keep: (r: PartyYear) => boolean): LinePoint[] =>
    years.map((year) => {
      const these = rows.filter((r) => r.year === year && keep(r))
      const speeches = these.reduce((a, r) => a + r.speeches, 0)
      const ai = these.reduce((a, r) => a + r.ai_speeches, 0)
      return { x: year, y: speeches ? ai / speeches : 0, label: String(year) }
    })
  const all = share(() => true)
  const parties = [...new Set(rows.map((r) => r.party))].sort()
  const chosen = party === 'all' ? all : share((r) => r.party === party)
  const first = all[0]
  const last = all[all.length - 1]
  const until = ok(summary) ? summary.last_date : undefined
  const head = l(
    `The share of Riksdag speeches that mention AI went from ${pct(first.y)} in ${first.x} to ${pct(last.y)} in ${last.x}${until ? ` (to ${until})` : ''}.`,
    `Andelen riksdagsanföranden som nämner AI gick från ${pct(first.y)} ${first.x} till ${pct(last.y)} ${last.x}${until ? ` (till ${until})` : ''}.`,
  )
  return (
    <Mini
      head={head}
      control={
        <label className="mini-select">
          {l('Party', 'Parti')}{' '}
          <select value={party} onChange={(e) => setParty(e.target.value)}>
            <option value="all">{l('All parties', 'Alla partier')}</option>
            {parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      }
      caption={l(
        `Share of each year's speeches that mention AI${party === 'all' ? '' : `, ${party} against all parties (grey)`}. ai-act/politics/party-year.json`,
        `Andel av årets anföranden som nämner AI${party === 'all' ? '' : `, ${party} mot alla partier (grått)`}. ai-act/politics/party-year.json`,
      )}
    >
      <MiniLine
        series={
          party === 'all'
            ? [{ id: 'all', name: 'all', points: all }]
            : [
                { id: party, name: party, points: chosen },
                { id: 'all', name: 'all', points: all },
              ]
        }
        summary={head}
        format={(v) => pct(v)}
        ticks={ticksFor(all)}
      />
    </Mini>
  )
}

type Eval = {
  compared: {
    model: string
    setting: string
    questions: number
    verified_share: number
    recall_at_k: number
    k: number
  }[]
}

export function LawChart() {
  const evaluation = useFile<Eval>('workers-ai/eval.json')
  if (!ok(evaluation) || !evaluation.compared.length) return null
  const rows = evaluation.compared
  const best = rows.reduce((a, b) =>
    b.verified_share > a.verified_share ? b : a,
  )
  const name = (r: Eval['compared'][number]) =>
    `${r.model.split('/').pop()} (${r.setting})`
  const head = l(
    `${name(best)} answered ${pct(best.verified_share, 0)} of ${best.questions} test questions with every quote verified, the best of ${rows.length} set-ups.`,
    `${name(best)} svarade på ${pct(best.verified_share, 0)} av ${best.questions} testfrågor med alla citat verifierade, bäst av ${rows.length} uppsättningar.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        'Share of evaluation questions answered with every quote found word for word in the law. workers-ai/eval.json',
        'Andel av utvärderingsfrågorna som besvarades med alla citat återfunna ord för ord i lagen. workers-ai/eval.json',
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: `${r.model.split('/').pop()}, ${r.setting}`,
          value: r.verified_share,
          focal: r === best,
          note: l(
            `${num(r.questions)} questions, recall@${r.k} ${pct(r.recall_at_k, 0)}`,
            `${num(r.questions)} frågor, recall@${r.k} ${pct(r.recall_at_k, 0)}`,
          ),
        }))}
        summary={head}
        format={(v) => pct(v, 0)}
        max={1}
      />
    </Mini>
  )
}
