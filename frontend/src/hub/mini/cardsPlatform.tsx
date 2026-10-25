/**
 * Mini dashboards for the hub's platform cards: SWEDEN (library visits or the language of job
 * ads), the chart feed (AI in Riksdag speeches, by party) and Ask the law (verified answers per
 * model). Each reads its project's own published files and states one finding in its headline;
 * while a file loads its room is held, and a file that cannot be read leaves no chart.
 */
import { useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { ok, useFile } from '../../tech/techData'
import { Loading, MiniBars, MiniLine, type LinePoint } from './MiniChart'

/** A share as a percentage; below 1 % it keeps two decimals, so a small share is not shown as 0. */
export const pct = (v: number, digits = 1) =>
  `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : digits).replace(/\.0+$/, '')} %`

/** The year now: a file's row for it covers only part of the year. */
const THIS_YEAR = new Date().getFullYear()

/** A card's chart with its finding above and its unit, period and file below. */
export function Mini(props: {
  head: string
  control?: ReactNode
  caption: string
  children: ReactNode
}) {
  return (
    <figure className="mini-card">
      {props.control}
      <p className="mini-head">{props.head}</p>
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

const ends = (points: LinePoint[]) =>
  [points[0], points[points.length - 1]].map((p) => ({
    x: p.x,
    label: String(p.x),
  }))

type Change = {
  balanced_visits: { municipalities: number; totals: Record<string, number> }
}
type Trends = { categories: { id: string; rows: (number | null)[][] }[] }

function libraries(change: Change, control: ReactNode) {
  const { municipalities, totals } = change.balanced_visits
  const points = Object.entries(totals).map(([year, v]) => ({
    x: Number(year),
    y: v / 1e6,
    label: year,
  }))
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const low = points.reduce((a, b) => (b.y < a.y ? b : a))
  const m = (v: number) => `${v.toFixed(1)} M`
  const head = l(
    `Library visits fell from ${m(first.y)} in ${first.x} to ${m(low.y)} in ${low.x} and were ${m(last.y)} in ${last.x}.`,
    `Biblioteksbesöken föll från ${m(first.y)} ${first.x} till ${m(low.y)} ${low.x} och var ${m(last.y)} ${last.x}.`,
  )
  return (
    <Mini
      head={head}
      control={control}
      caption={l(
        `Visits to public libraries per year, millions, ${first.x}–${last.x}, in the ${municipalities} municipalities that report every year. sweden/belonging/change.json`,
        `Besök på folkbibliotek per år, miljoner, ${first.x}–${last.x}, i de ${municipalities} kommuner som rapporterar varje år. sweden/belonging/change.json`,
      )}
    >
      <MiniLine
        series={[{ id: 'visits', name: 'visits', points }]}
        summary={head}
        format={m}
        ticks={ends(points)}
      />
    </Mini>
  )
}

function language(trends: Trends, control: ReactNode) {
  const passion = trends.categories.find((c) => c.id === 'passion')
  // The file's main measure: matches per 1,000 words with the occupation-field mix held fixed.
  const points = (passion?.rows ?? [])
    .filter((r) => r[8] !== null)
    .map((r) => ({
      x: r[0]!,
      y: r[8]!,
      label:
        r[0] === THIS_YEAR
          ? `${r[0]} ${l('so far', 'hittills')}`
          : String(r[0]),
    }))
  const whole = points.filter((p) => p.x < THIS_YEAR)
  if (whole.length < 2) return null
  const first = whole[0]
  const last = whole[whole.length - 1]
  const f = (v: number) => v.toFixed(2)
  const head = l(
    `Words of passion in job ads went from ${f(first.y)} to ${f(last.y)} per 1,000 words between ${first.x} and ${last.x}.`,
    `Ord om passion i platsannonser gick från ${f(first.y)} till ${f(last.y)} per 1 000 ord mellan ${first.x} och ${last.x}.`,
  )
  const partial = points.length > whole.length
  return (
    <Mini
      head={head}
      control={control}
      caption={l(
        `Matches of “passion and enthusiasm” per 1,000 words of distinct ad text, occupation-field mix held fixed, per year, ${first.x}–${points[points.length - 1].x}${partial ? ` (${THIS_YEAR} so far)` : ''}. sweden/language/trends.json`,
        `Träffar för ”passion och entusiasm” per 1 000 ord unik annonstext, med yrkesfältens mix fast, per år, ${first.x}–${points[points.length - 1].x}${partial ? ` (${THIS_YEAR} hittills)` : ''}. sweden/language/trends.json`,
      )}
    >
      <MiniLine
        series={[{ id: 'passion', name: 'passion', points }]}
        summary={head}
        format={f}
        ticks={ends(points)}
      />
    </Mini>
  )
}

export function SwedenChart() {
  const change = useFile<Change>('sweden/belonging/change.json')
  const trends = useFile<Trends>('sweden/language/trends.json')
  const [study, setStudy] = useState<'libraries' | 'language'>('libraries')
  if (change === null && trends === null) return <Loading />
  const both = ok(change) && ok(trends)
  const control = both ? (
    <Segmented
      label={l('Study', 'Studie')}
      options={[
        ['libraries', l('Libraries', 'Bibliotek')],
        ['language', l('Ad language', 'Annonsspråk')],
      ]}
      value={study}
      onChange={setStudy}
    />
  ) : undefined
  if (ok(change) && (study === 'libraries' || !ok(trends)))
    return libraries(change, control)
  if (ok(trends)) return language(trends, control)
  return null
}

type PartyYear = {
  party: string
  year: number
  speeches: number
  ai_speeches: number
}

export function FeedChart() {
  const rows = useFile<PartyYear[]>('ai-act/politics/party-year.json')
  const summary = useFile<{ first_date: string; last_date: string }>(
    'ai-act/politics/summary.json',
  )
  const [party, setParty] = useState('all')
  if (rows === null) return <Loading />
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
  if (all.length < 2) return null
  const parties = [...new Set(rows.map((r) => r.party))].sort()
  const shown = party === 'all' ? all : share((r) => r.party === party)
  // The first and last years are partial (the file's first and last dates); the headline runs
  // from the first whole year to the last.
  const from = shown[1] ?? shown[0]
  const last = shown[shown.length - 1]
  const until = ok(summary) ? summary.last_date : undefined
  const whoSv =
    party === 'all' ? 'riksdagsanföranden' : `anföranden från ${party}`
  const head = l(
    `The share of ${party === 'all' ? 'Riksdag' : `${party}'s`} speeches that mention AI went from ${pct(from.y)} in ${from.x} to ${pct(last.y)} in ${last.x}${until ? ` (to ${until})` : ''}.`,
    `Andelen ${whoSv} som nämner AI gick från ${pct(from.y)} ${from.x} till ${pct(last.y)} ${last.x}${until ? ` (till ${until})` : ''}.`,
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
        `Share of each year's speeches that mention AI, ${ok(summary) ? `${summary.first_date} to ${summary.last_date}` : `${years[0]}–${years[years.length - 1]}`}. ai-act/politics/party-year.json`,
        `Andel av årets anföranden som nämner AI, ${ok(summary) ? `${summary.first_date} till ${summary.last_date}` : `${years[0]}–${years[years.length - 1]}`}. ai-act/politics/party-year.json`,
      )}
    >
      <MiniLine
        series={
          party === 'all'
            ? [{ id: 'all', name: 'all', points: all }]
            : [
                { id: party, name: party, points: shown },
                {
                  id: 'all',
                  name: l('All parties', 'Alla partier'),
                  points: all,
                },
              ]
        }
        summary={head}
        format={(v) => pct(v)}
        ticks={ends(all)}
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
  if (evaluation === null) return <Loading />
  if (!ok(evaluation) || !evaluation.compared.length) return null
  const rows = evaluation.compared
  const best = rows.reduce((a, b) =>
    b.verified_share > a.verified_share ? b : a,
  )
  const model = (r: Eval['compared'][number]) => r.model.split('/').pop()
  const head = l(
    `${pct(best.verified_share, 0)} of answers had every quote verified against the law: the highest of ${rows.length} model set-ups, on ${best.questions} test questions.`,
    `${pct(best.verified_share, 0)} av svaren hade alla citat verifierade mot lagen: högst av ${rows.length} modelluppsättningar, på ${best.questions} testfrågor.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        'Share of evaluation questions answered with every quote found word for word in the law, per model and setting; the file records no run date. workers-ai/eval.json',
        'Andel av utvärderingsfrågorna som besvarades med alla citat återfunna ord för ord i lagen, per modell och inställning; filen anger inget körningsdatum. workers-ai/eval.json',
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: l(
            `${model(r)}, ${r.setting} (${r.questions} questions)`,
            `${model(r)}, ${r.setting} (${r.questions} frågor)`,
          ),
          value: r.verified_share,
          focal: r === best,
          note: l(
            `recall@${r.k} ${pct(r.recall_at_k, 0)}`,
            `recall@${r.k} ${pct(r.recall_at_k, 0)}`,
          ),
        }))}
        summary={head}
        format={(v) => pct(v, 0)}
        max={1}
      />
    </Mini>
  )
}
