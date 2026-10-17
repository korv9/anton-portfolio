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
import { Board, Card, Cards, Empty } from '../board/Board'
import { BoxPlot, Stacked } from '../../charts/Compare'
import { Select, dayName, num } from '../controls'
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
  const kindForChart = view.typ === 'alla' ? 'sou' : view.typ
  // A study takes one to three years to become a bill: the share is read from years that are
  // at least three years old.
  const settled = data.per_year.filter(
    (r) => r.kind === kindForChart && r.year <= new Date().getFullYear() - 3,
  )
  const settledPublished = settled.reduce((s, r) => s + r.published, 0)
  const settledCited = settled.reduce((s, r) => s + r.cited, 0)
  const leadTimes = data.recent_laws.flatMap((law) =>
    law.studies
      .map((st) => data.latest.find((s) => s.designation === st.designation))
      .filter((s): s is Study => !!s)
      .map((s) => months(s.published, law.decided)),
  )

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
      <Cards>
        <Card
          index={0}
          wide
          title={l(
            'Recent laws and the studies they rest on',
            'Nya lagar och utredningarna de bygger på',
          )}
          meta={l(
            'Newest decision first. Each law is named with the studies its bill cites as its basis.',
            'Nyaste beslutet först. Varje lag står med utredningarna som propositionen anger som underlag.',
          )}
        >
          <ol className="law-chains">
            {data.recent_laws.slice(0, 8).map((law) => (
              <li key={law.bill}>
                <div className="law-head">
                  <a href={law.url} target="_blank" rel="noreferrer">
                    {law.title}
                  </a>
                  <span className="law-decided">
                    Prop. {law.bill}, {l('decided', 'beslut')}{' '}
                    {dayName(law.decided)}
                    {law.department && `, ${law.department}`}
                  </span>
                </div>
                <div className="law-basis">
                  <p>{l('Rests on', 'Bygger på')}</p>
                  <ul className="law-studies">
                    {law.studies.map((st) => {
                      const known = data.latest.find(
                        (s) => s.designation === st.designation,
                      )
                      const text = (
                        <>
                          <b>
                            {st.kind === 'pm'
                              ? l('Memorandum', 'Promemoria')
                              : st.designation}
                          </b>{' '}
                          {st.title}
                        </>
                      )
                      return (
                        <li key={st.designation + st.url}>
                          {known ? (
                            <button
                              type="button"
                              onClick={() =>
                                setView({ vald: known.key, typ: 'alla' })
                              }
                            >
                              {text}
                            </button>
                          ) : (
                            <a href={st.url} target="_blank" rel="noreferrer">
                              {text}
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
          <p className="dash-meta">{data.method}</p>
        </Card>
        {settledPublished > 0 && (
          <Card
            index={2}
            title={l('Led to a bill', 'Ledde till en proposition')}
            meta={l(
              `${kindName(kindForChart)} at least three years old: a study takes one to three years to become a bill`,
              `${kindName(kindForChart)} som är minst tre år gamla: en utredning tar ett till tre år att bli proposition`,
            )}
          >
            <Stacked
              rows={[
                {
                  key: 'led',
                  values: [settledCited, settledPublished - settledCited],
                },
              ]}
              parts={[
                {
                  label: l('Led to a bill', 'Ledde till proposition'),
                  colour: 'var(--color-chart-neutral)',
                },
                {
                  label: l('No bill', 'Ingen proposition'),
                  colour: 'var(--color-chart-muted)',
                },
              ]}
              format={(v) => num(v)}
              label={l(
                `${settledCited} of ${settledPublished} studies led to a bill`,
                `${settledCited} av ${settledPublished} utredningar ledde till en proposition`,
              )}
            />
          </Card>
        )}
        {leadTimes.length > 4 && (
          <Card
            index={3}
            title={l('From study to law', 'Från utredning till lag')}
            meta={l(
              `Months from a study’s publication to the decision, ${leadTimes.length} studies behind recent laws`,
              `Månader från utredningens publicering till beslutet, ${leadTimes.length} utredningar bakom nya lagar`,
            )}
          >
            <BoxPlot
              values={leadTimes}
              format={(v) => `${num(v)} ${l('mo', 'mån')}`}
              label={l(
                `Lead time from study to law, ${leadTimes.length} studies`,
                `Ledtid från utredning till lag, ${leadTimes.length} utredningar`,
              )}
            />
          </Card>
        )}
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
      </Cards>
    </Board>
  )
}
