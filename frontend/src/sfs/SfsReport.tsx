/**
 * The statute-book report: what Riksdagen's SFS list holds, when it was issued and repealed, and
 * how large the laws are. One question per tab. The numbers come from sfs/overview.json, which
 * platform/publish/export_sfs.py writes from fct_sfs_document.
 */
import { useEffect, useState } from 'react'
import { SFS_TABS, type Route } from '../router'
import ReportShell, { ReportFrame } from '../report/ReportShell'
import { Feature } from '../charts/feature/Feature'
import RankBars from '../charts/RankBars'
import MultiLineChart from '../charts/MultiLineChart'
import { Stacked } from '../charts/Compare'
import { fetchData } from '../dataSource'
import './sfs.css'

type Kind = 'lag' | 'förordning' | 'other'
type PassageKind = 'paragraph' | 'whole_text'
type Overview = {
  fetched: { first: string; last: string }
  kinds: {
    kind: Kind
    documents: number
    fetched: number
    repealed: number
    sections: number
    paragraph_passages: number
    whole_text_passages: number
  }[]
  parse: { status: string; documents: number; with_whole_text: number }[]
  missing: { dok_id: string; sfs: string; title: string; issued: string }[]
  years: ({ year: number; repealed: number } & Record<Kind, number>)[]
  lengths: { kind: PassageKind; up_to: number | null; passages: number }[]
  length_stats: { kind: PassageKind; p50: number; p95: number; max: number }[]
  largest: {
    dok_id: string
    sfs: string
    title: string
    sections: number
    paragraph_passages: number
  }[]
  tests: { pass: number; warn: number }
}

const NAME = 'Swedish Statute Book'
const SOURCE = 'Riksdagen open data, SFS list and texts (data.riksdagen.se)'
const KINDS: Record<Kind, string> = {
  lag: 'Laws',
  förordning: 'Ordinances',
  other: 'Other',
}
// One focal colour: what is in force, or what was repealed, depending on the chart.
const FOCAL = 'var(--accent)'
const QUIET = 'var(--stone)'

const TABS = [
  { label: 'Coverage', question: 'What does the statute book hold?' },
  {
    label: 'Over time',
    question: 'When were the statutes issued, and when repealed?',
  },
  { label: 'Size', question: 'How large are the laws in force?' },
].map((tab, i) => ({ ...tab, path: SFS_TABS[i] }))

const DEEPER = [
  {
    href: '#fraga-lagen',
    label: 'Ask the law',
    about:
      'Questions answered with checked quotes. Its search covers 40 selected laws, not this whole collection',
  },
  {
    href: 'https://github.com/korv9/anton-portfolio/blob/main/docs/workers-ai.md',
    label: 'Method',
    about: 'How the list and texts are fetched, parsed and tested',
  },
]

const n = (v: number) => v.toLocaleString('en-GB')
const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
const total = (data: Overview, key: 'documents' | 'repealed' | 'sections') =>
  data.kinds.reduce((s, k) => s + k[key], 0)

type Props = { data: Overview }

function Coverage({ data }: Props) {
  const rows = [
    ...data.kinds.map((k) => ({ ...k, label: KINDS[k.kind] })),
    {
      label: 'All',
      kind: 'all',
      documents: total(data, 'documents'),
      repealed: total(data, 'repealed'),
    },
  ]
  const status = (s: string) =>
    data.parse.find((p) => p.status === s) ?? {
      documents: 0,
      with_whole_text: 0,
    }
  const unnumbered = status('unnumbered')
  return (
    <>
      <div className="report-main">
        <Feature
          id="i-kraft"
          title="In force and repealed, by kind"
          source={`${SOURCE}; repealed by the date on the text’s “Upphävd” line; kind from the first word of the title: laws include the codes (balkar) and the fundamental laws, and “other” is mostly proclamations (kungörelser), notices (tillkännagivanden) and royal letters`}
        >
          <Stacked
            rows={rows.map((r) => ({
              key: r.kind,
              label: r.label,
              values: [r.documents - r.repealed, r.repealed],
              text: `${n(r.documents - r.repealed)} of ${n(r.documents)}`,
            }))}
            parts={[
              { label: 'In force', colour: FOCAL },
              { label: 'Repealed', colour: QUIET },
            ]}
            format={n}
            label="Documents in force and repealed, per kind"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="tolkning"
          title="What came out of each text"
          source={`${SOURCE}; parse status in int_sfs_documents. A text without a numbered paragraph is kept as whole-text passages, unless it is scanned XML or has nothing after its header`}
        >
          <RankBars
            rows={[
              {
                key: 'parsed',
                label: 'Split into numbered paragraphs',
                value: status('parsed').documents,
              },
              {
                key: 'unnumbered',
                label: `No numbered paragraph (${n(unnumbered.with_whole_text)} kept as whole text)`,
                value: unnumbered.documents,
              },
              {
                key: 'missing',
                label: 'No text fetched',
                value: status('no text').documents,
              },
            ]}
            format={n}
            label="Documents per parse status"
          />
        </Feature>
        <Feature
          id="saknas"
          title={`The ${data.missing.length} texts that could not be fetched`}
          source={`${SOURCE}; each has an old supplement number (bih.) in its id, and data.riksdagen.se answers 404 at every address tried`}
        >
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Texts that could not be fetched"
          >
            <table className="data-table sfs-missing">
              <thead>
                <tr>
                  <th scope="col">SFS</th>
                  <th scope="col">Title</th>
                </tr>
              </thead>
              <tbody>
                {data.missing.map((m) => (
                  <tr key={m.dok_id}>
                    <td translate="no">{m.sfs}</td>
                    <td lang="sv">{m.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Feature>
      </div>
      <div className="report-main">
        <Built data={data} />
      </div>
    </>
  )
}

/** The pipeline from Riksdagen's list to this page, with the count at each step. */
function Built({ data }: Props) {
  const passages = data.kinds.reduce(
    (s, k) => s + k.paragraph_passages + k.whole_text_passages,
    0,
  )
  const fetched = data.kinds.reduce((s, k) => s + k.fetched, 0)
  const steps = [
    {
      name: 'Catalogue',
      where: 'raw/sfs/catalogue.json',
      count: `${n(total(data, 'documents'))} documents listed`,
    },
    {
      name: 'Texts',
      where: 'raw/sfs/texts/, copied to R2 under warehouse/raw/sfs/',
      count: `${n(fetched)} texts fetched`,
    },
    {
      name: 'Bronze',
      where: 'stg_sfs_texts',
      count: 'each text as served',
    },
    {
      name: 'Silver',
      where: 'int_sfs_documents, int_sfs_corpus_paragraphs',
      count: `${n(passages)} passages`,
    },
    {
      name: 'Gold',
      where: 'fct_sfs_document, exported to sfs/overview.json',
      count: `${n(total(data, 'sections'))} numbered paragraphs`,
    },
  ]
  return (
    <Feature
      id="bygget"
      title="From the Riksdag’s list to this page"
      source="platform/pipeline.yml, subject sfs; docs/workers-ai.md"
    >
      <ol className="sfs-flow" aria-label="Pipeline steps">
        {steps.map((s, i) => (
          <li key={s.name} className={i === steps.length - 1 ? 'focal' : ''}>
            <b>{s.name}</b>
            <span>{s.count}</span>
            <code translate="no">{s.where}</code>
          </li>
        ))}
      </ol>
      <p className="sfs-note">
        The texts were fetched from {day(data.fetched.first)} to{' '}
        {day(data.fetched.last)}, with a one-second pause between requests. No
        schedule runs the refresh: it is started by hand, and a rerun fetches
        only the texts that are missing or whose list entry changed on or after
        the day of the last fetch. The last build passed {n(data.tests.pass)}{' '}
        dbt tests, with {n(data.tests.warn)} warning for the missing texts.
      </p>
    </Feature>
  )
}

const FIRST_YEAR = 1900
const REPEAL_FROM = 1980

function OverTime({ data }: Props) {
  const last = data.years.at(-1)!.year
  const range = (from: number) =>
    Array.from({ length: last - from + 1 }, (_, i) => from + i).map(
      (year) =>
        data.years.find((y) => y.year === year) ?? {
          year,
          lag: 0,
          förordning: 0,
          other: 0,
          repealed: 0,
        },
    )
  const point = (year: number, value: number) => ({
    date: `${year}-01-01`,
    label: String(year),
    value,
  })
  const issued = range(FIRST_YEAR)
  const before = data.years
    .filter((y) => y.year < FIRST_YEAR)
    .reduce((s, y) => s + y.lag + y.förordning + y.other, 0)
  const kinds = (Object.keys(KINDS) as Kind[]).map((kind) => ({
    key: kind,
    name: KINDS[kind],
    points: issued.map((y) => point(y.year, y[kind])),
  }))
  const recent = range(REPEAL_FROM)
  const repealedBefore = data.years
    .filter((y) => y.year < REPEAL_FROM)
    .reduce((s, y) => s + y.repealed, 0)
  const flows = [
    {
      key: 'issued',
      name: 'Issued',
      points: recent.map((y) => point(y.year, y.lag + y.förordning + y.other)),
    },
    {
      key: 'repealed',
      name: 'Repealed',
      points: recent.map((y) => point(y.year, y.repealed)),
    },
  ]
  const kindColour: Record<string, string> = {
    lag: FOCAL,
    förordning: QUIET,
    other: 'var(--line-strong)',
  }
  return (
    <>
      <div className="report-main">
        <Feature
          id="utfardade"
          title={`Statutes in the list by year of issue, ${FIRST_YEAR}–${last}`}
          table={
            <YearTable rows={issued} columns={Object.keys(KINDS) as Kind[]} />
          }
          source={`${SOURCE}; statutes in the Riksdag’s list by the year of their issue date (Utfärdad); ${n(before)} issued before ${FIRST_YEAR} are left out of the chart`}
        >
          <MultiLineChart
            series={kinds}
            format={n}
            colorOf={(key) => kindColour[key]}
            label="Statutes per year of issue, by kind"
          />
        </Feature>
      </div>
      <div className="report-main">
        <Feature
          id="upphavda"
          title={`Issued and repealed per year, ${REPEAL_FROM}–${last}`}
          table={<YearTable rows={recent} columns={['repealed']} />}
          source={`${SOURCE}; repeals by the date on the text’s “Upphävd” line, for statutes in the list; ${n(repealedBefore)} repeals before ${REPEAL_FROM} are left out of the chart`}
        >
          <MultiLineChart
            series={flows}
            format={n}
            colorOf={(key) => (key === 'repealed' ? FOCAL : QUIET)}
            label="Statutes issued and repealed per year"
          />
        </Feature>
      </div>
    </>
  )
}

function YearTable({
  rows,
  columns,
}: {
  rows: Overview['years']
  columns: (Kind | 'repealed')[]
}) {
  const label = (c: Kind | 'repealed') =>
    c === 'repealed' ? 'Repealed' : KINDS[c]
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Year</th>
          {columns.map((c) => (
            <th scope="col" className="num" key={c}>
              {label(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.year}>
            <th scope="row">{r.year}</th>
            {columns.map((c) => (
              <td className="num" key={c}>
                {n(r[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Size({ data }: Props) {
  const band = (kind: PassageKind) => {
    const rows = data.lengths.filter((l) => l.kind === kind)
    return rows.map((r, i) => {
      const from = i ? rows[i - 1].up_to! + 1 : 1
      return {
        key: String(r.up_to),
        label:
          r.up_to == null
            ? `Over ${n(rows[i - 1].up_to!)}`
            : `${n(from)}–${n(r.up_to)}`,
        value: r.passages,
      }
    })
  }
  // The most common band carries the emphasis; a band order is not a ranking.
  const modal = (kind: PassageKind) =>
    band(kind).reduce((a, b) => (b.value > a.value ? b : a)).key
  const stats = (kind: PassageKind) =>
    data.length_stats.find((s) => s.kind === kind)!
  const lengthLead = (kind: PassageKind) => {
    const s = stats(kind)
    return `Characters per passage: median ${n(s.p50)}, 95th percentile ${n(s.p95)}, longest ${n(s.max)}.`
  }
  return (
    <>
      <div className="report-main">
        <Feature
          id="storst"
          title={`The ${data.largest.length} laws in force with the most paragraphs`}
          source={`${SOURCE}; numbered paragraphs (§) in fct_sfs_document, counted once per chapter and number`}
        >
          <RankBars
            rows={data.largest.map((l) => ({
              key: l.dok_id,
              label: <span lang="sv">{l.title}</span>,
              value: l.sections,
            }))}
            format={n}
            label="Laws in force by number of paragraphs"
          />
        </Feature>
      </div>
      <div className="report-pair">
        <Feature
          id="paragraflangd"
          title="Paragraph passages by length"
          source={`${SOURCE}; int_sfs_corpus_paragraphs. ${lengthLead('paragraph')} A paragraph is one passage, or one per stycke when it is long`}
        >
          <RankBars
            rows={band('paragraph')}
            picked={modal('paragraph')}
            format={n}
            label="Paragraph passages per length band, in characters"
          />
        </Feature>
        <Feature
          id="heltextlangd"
          title="Whole-text passages by length"
          source={`${SOURCE}; int_sfs_corpus_paragraphs. ${lengthLead('whole_text')} A text without numbered paragraphs is cut into pieces of at most 1,500 characters`}
        >
          <RankBars
            rows={band('whole_text')}
            picked={modal('whole_text')}
            format={n}
            label="Whole-text passages per length band, in characters"
          />
        </Feature>
      </div>
    </>
  )
}

export default function SfsReport({ route }: { route: Route }) {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchData('sfs/overview.json')
      .then((r) => r.json())
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])
  const Body = [Coverage, OverTime, Size][
    Math.max(0, SFS_TABS.indexOf(route.path))
  ]
  return (
    <ReportFrame>
      <ReportShell
        name={NAME}
        intro={
          data
            ? `Every document in the Riksdag’s SFS list, ${n(total(data, 'documents'))} statutes in force or repealed, fetched as text and split into ${n(total(data, 'sections'))} numbered paragraphs. Ask the law searches 40 of these laws; this page counts all of them.`
            : 'Every document in the Riksdag’s SFS list, fetched as text and split into numbered paragraphs.'
        }
        tabs={TABS}
        path={route.path}
        deeper={DEEPER}
      >
        {error && (
          <p role="alert">
            The statute-book numbers did not load ({error}). Reload the page to
            try again.
          </p>
        )}
        {!data && !error && <p role="status">Loading…</p>}
        {data && <Body data={data} />}
      </ReportShell>
    </ReportFrame>
  )
}
