/**
 * Utredningar: the studies that come before the laws. Government inquiries (SOU), ministry
 * reports (Ds) and the National Audit Office's reports (RiR), how many each year and how many
 * a bill later names as its basis, the latest studies as a list with a panel to read one in
 * depth, and the laws recently decided with the studies they rest on, as a chain.
 * From parliament/studies.json (the Riksdag's open data; the link is read from each bill).
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { load } from '../../parliament/data'
import type { Route } from '../../router'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import Columns from '../board/Columns'
import { Select, dayName, num, pct } from '../controls'
import { useViewParams } from '../useViewParams'
import './utredningar.css'

type Bill = {
  bill: string
  title: string
  bill_date: string | null
  url: string
  decided: string | null
}
type Study = {
  key: string
  kind: 'sou' | 'ds' | 'rir' | 'pm'
  designation: string
  title: string
  inquiry: string | null
  published: string
  url: string
  bills: Bill[]
}
type Law = {
  bill: string
  title: string
  department: string | null
  url: string
  decided: string
  studies: { kind: string; designation: string; title: string; url: string }[]
}
type StudiesData = {
  generated_at: string
  latest: Study[]
  per_year: { year: number; kind: string; published: number; cited: number }[]
  recent_laws: Law[]
  kinds: Record<string, [string, string]>
  method: string
}

const DEFAULTS = { typ: 'sou', sok: '', vald: '', status: '' }

const months = (from: string, to: string) =>
  Math.max(
    0,
    Math.round((Date.parse(to) - Date.parse(from)) / (30.44 * 86_400_000)),
  )

export default function UtredningarTheme({ route }: { route: Route }) {
  const [data, setData] = useState<StudiesData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useViewParams(route, DEFAULTS)
  const [query, setQuery] = useState(view.sok)
  useEffect(() => {
    load<StudiesData>('parliament/studies.json')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  const list = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLowerCase()
    return data.latest.filter(
      (s) =>
        (view.typ === 'alla' || s.kind === view.typ) &&
        (view.status === ''
          ? true
          : view.status === 'lag'
            ? s.bills.some((b) => b.decided)
            : view.status === 'prop'
              ? s.bills.length > 0
              : s.bills.length === 0) &&
        (!needle ||
          `${s.designation} ${s.title} ${s.inquiry ?? ''}`
            .toLowerCase()
            .includes(needle)),
    )
  }, [data, view.typ, view.status, query])

  if (error)
    return (
      <p role="alert" className="theme-error">
        {error}
      </p>
    )
  if (!data) return <Empty />

  const kindName = (kind: string) => {
    const k = data.kinds[kind]
    return k ? l(...k) : kind.toUpperCase()
  }
  const chosen = data.latest.find((s) => s.key === view.vald) ?? list[0] ?? null
  const years = [...new Set(data.per_year.map((r) => r.year))].sort()
  const perKind = (kind: string, field: 'published' | 'cited') =>
    years.map(
      (y) =>
        data.per_year.find((r) => r.year === y && r.kind === kind)?.[field] ??
        0,
    )
  const kindForChart = view.typ === 'alla' ? 'sou' : view.typ
  const lastFull = years.filter((y) => y <= new Date().getFullYear() - 1).at(-1)
  const thisYear = years.at(-1)
  const published = (kind: string, y?: number) =>
    data.per_year.find((r) => r.year === y && r.kind === kind)?.published ?? 0
  // A study takes one to three years to become a bill: the share is read from years that are
  // at least three years old.
  const settled = data.per_year.filter(
    (r) => r.kind === kindForChart && r.year <= new Date().getFullYear() - 3,
  )
  const settledShare =
    settled.reduce((s, r) => s + r.published, 0) > 0
      ? (settled.reduce((s, r) => s + r.cited, 0) /
          settled.reduce((s, r) => s + r.published, 0)) *
        100
      : 0
  const leadTimes = data.recent_laws.flatMap((law) =>
    law.studies
      .map((st) => data.latest.find((s) => s.designation === st.designation))
      .filter((s): s is Study => !!s)
      .map((s) => months(s.published, law.decided)),
  )
  const medianLead = leadTimes.length
    ? [...leadTimes].sort((a, b) => a - b)[Math.floor(leadTimes.length / 2)]
    : null

  return (
    <Board
      title={l('The studies before the laws', 'Utredningarna före lagarna')}
      sub={l(
        'Government inquiries (SOU), ministry reports (Ds) and audit reports: what they are about, and which of them a bill later rests on. Choose a study to read it in depth.',
        'Statens offentliga utredningar (SOU), departementsserien (Ds) och granskningsrapporter: vad de handlar om och vilka en proposition sedan bygger på. Välj en utredning för att fördjupa dig.',
      )}
      slicers={
        <>
          <Select
            label={l('Series', 'Serie')}
            value={view.typ}
            options={[
              { value: 'sou', label: 'SOU' },
              { value: 'ds', label: 'Ds' },
              { value: 'rir', label: l('Audit (RiR)', 'Granskning (RiR)') },
              { value: 'alla', label: l('All', 'Alla') },
            ]}
            onChange={(typ) => setView({ typ, vald: '' })}
          />
          <Select
            label={l('Led to', 'Ledde till')}
            value={view.status}
            options={[
              { value: '', label: l('Everything', 'Allt') },
              { value: 'prop', label: l('A bill', 'En proposition') },
              { value: 'lag', label: l('A decided law', 'Ett fattat beslut') },
              { value: 'inget', label: l('Nothing yet', 'Inget ännu') },
            ]}
            onChange={(status) => setView({ status, vald: '' })}
          />
          <label className="board-search">
            <span>{l('Search', 'Sök')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setView({ sok: e.target.value, vald: '' })
              }}
              placeholder={l('e.g. school', 't.ex. skola')}
            />
          </label>
        </>
      }
    >
      <Kpis>
        <Kpi
          index={0}
          label={l(
            `${kindName(kindForChart)} ${thisYear}`,
            `${kindName(kindForChart)} ${thisYear}`,
          )}
          value={published(kindForChart, thisYear)}
          format={(v) => num(v)}
          sub={l('published so far', 'publicerade hittills')}
        />
        <Kpi
          index={1}
          label={l(`In ${lastFull}`, `Under ${lastFull}`)}
          value={published(kindForChart, lastFull)}
          format={(v) => num(v)}
          sub={l('a full year', 'ett helt år')}
        />
        <Kpi
          index={2}
          label={l('Led to a bill', 'Ledde till en proposition')}
          value={settledShare}
          format={(v) => pct(v, 0)}
          sub={l(
            'of those three or more years old',
            'av dem som är minst tre år gamla',
          )}
        />
        {medianLead != null && (
          <Kpi
            index={3}
            label={l('From study to law', 'Från utredning till lag')}
            value={medianLead}
            format={(v) => `${num(v)} ${l('months', 'mån')}`}
            sub={l('median, recent laws', 'median, nya lagar')}
          />
        )}
      </Kpis>

      <Cards>
        <Card
          index={0}
          wide
          title={l(
            'Published each year, and how many a bill rests on',
            'Publicerade varje år, och hur många en proposition bygger på',
          )}
          meta={l(
            `${kindName(kindForChart)}, the newest years have not had time to lead to bills yet`,
            `${kindName(kindForChart)}, de senaste åren har ännu inte hunnit leda till propositioner`,
          )}
        >
          <Columns
            categories={years.map(String)}
            series={[
              {
                key: 'published',
                label: l('Published', 'Publicerade'),
                values: perKind(kindForChart, 'published'),
              },
              {
                key: 'cited',
                label: l('Named in a bill', 'Underlag i en proposition'),
                values: perKind(kindForChart, 'cited'),
              },
            ]}
            format={(v) => num(v)}
            label={l('Studies per year', 'Utredningar per år')}
          />
        </Card>

        <Card
          index={1}
          title={l('The studies', 'Utredningarna')}
          meta={l(
            `${num(list.length)} studies, newest first, choose one`,
            `${num(list.length)} utredningar, nyast först, välj en`,
          )}
        >
          <ol className="study-list">
            {list.slice(0, 80).map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  aria-pressed={chosen?.key === s.key}
                  onClick={() => setView({ vald: s.key })}
                >
                  <span className={`study-kind ${s.kind}`}>
                    {s.designation}
                  </span>
                  <b>{s.title}</b>
                  <small>
                    {dayName(s.published)}
                    {s.bills.length > 0 &&
                      `, ${l('led to', 'ledde till')} ${s.bills.length} ${l(s.bills.length === 1 ? 'bill' : 'bills', s.bills.length === 1 ? 'proposition' : 'propositioner')}`}
                  </small>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="dash-empty">
                {l('No study matches.', 'Ingen utredning matchar.')}
              </li>
            )}
          </ol>
        </Card>

        <Card
          index={2}
          title={chosen ? chosen.designation : l('A study', 'En utredning')}
          meta={chosen ? kindName(chosen.kind) : undefined}
        >
          {chosen ? (
            <article className="study-detail">
              <h3>{chosen.title}</h3>
              <dl>
                <div>
                  <dt>{l('Published', 'Publicerad')}</dt>
                  <dd>{dayName(chosen.published)}</dd>
                </div>
                {chosen.inquiry && (
                  <div>
                    <dt>{l('Inquiry', 'Utredning')}</dt>
                    <dd>{chosen.inquiry}</dd>
                  </div>
                )}
                <div>
                  <dt>{l('Led to', 'Ledde till')}</dt>
                  <dd>
                    {chosen.bills.length
                      ? `${chosen.bills.length} ${l('bills', 'propositioner')}`
                      : l(
                          'No bill yet: studies often take one to three years to become one.',
                          'Ingen proposition ännu: det tar ofta ett till tre år.',
                        )}
                  </dd>
                </div>
              </dl>
              {chosen.bills.length > 0 && (
                <ol className="study-chain">
                  <li>
                    <span className="study-step">
                      {l('Study', 'Utredning')}
                    </span>
                    <b>{chosen.designation}</b>
                    <small>{dayName(chosen.published)}</small>
                  </li>
                  {chosen.bills.map((b) => (
                    <li key={b.bill}>
                      <span className="study-step">
                        {b.decided
                          ? l('Bill → decided', 'Proposition → beslut')
                          : l('Bill', 'Proposition')}
                      </span>
                      <a href={b.url} target="_blank" rel="noreferrer">
                        Prop. {b.bill} {b.title}
                      </a>
                      <small>
                        {b.bill_date ? dayName(b.bill_date) : ''}
                        {b.decided
                          ? ` → ${l('decided', 'beslut')} ${dayName(b.decided)} (${months(chosen.published, b.decided)} ${l('months after the study', 'mån efter utredningen')})`
                          : ''}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <p>
                <a
                  className="board-button"
                  href={chosen.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {l(
                    'Read the study at riksdagen.se',
                    'Läs utredningen på riksdagen.se',
                  )}
                </a>
              </p>
            </article>
          ) : (
            <Empty>{l('Choose a study.', 'Välj en utredning.')}</Empty>
          )}
        </Card>

        <Card
          index={3}
          wide
          title={l(
            'Recent laws and the studies they rest on',
            'Nya lagar och utredningarna de bygger på',
          )}
          meta={l(
            'Newest decision first, study → bill → decision',
            'Nyaste beslutet först, utredning → proposition → beslut',
          )}
        >
          <ol className="law-chains">
            {data.recent_laws.slice(0, 12).map((law) => (
              <li key={law.bill}>
                <div className="law-studies">
                  {law.studies.map((st) => {
                    const known = data.latest.find(
                      (s) => s.designation === st.designation,
                    )
                    return known ? (
                      <button
                        key={st.designation}
                        type="button"
                        onClick={() =>
                          setView({ vald: known.key, typ: 'alla' })
                        }
                      >
                        {st.designation}
                      </button>
                    ) : (
                      <a
                        key={st.designation}
                        href={st.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {st.kind === 'pm'
                          ? l('Memorandum', 'Promemoria')
                          : st.designation}
                      </a>
                    )
                  })}
                </div>
                <span className="law-arrow" aria-hidden="true">
                  →
                </span>
                <a href={law.url} target="_blank" rel="noreferrer">
                  <b>Prop. {law.bill}</b> {law.title}
                </a>
                <span className="law-arrow" aria-hidden="true">
                  →
                </span>
                <span className="law-decided">
                  {l('Decided', 'Beslut')} {dayName(law.decided)}
                  {law.department && <small>{law.department}</small>}
                </span>
              </li>
            ))}
          </ol>
          <p className="dash-meta">{data.method}</p>
        </Card>
      </Cards>
    </Board>
  )
}
