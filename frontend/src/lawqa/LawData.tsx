/**
 * The two corpora as data, below the question tool: the whole Swedish statute book
 * (sfs/overview.json) with Allegora's 40 laws marked, and the AI Act's articles by date of
 * application and by what the Digital Omnibus changed (ai-act/articles.json, summary.json).
 * Both files are small (16 kB and 98 kB); the question corpus still loads only on first use.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'

type Sfs = {
  kinds: { kind: string; documents: number; repealed: number }[]
  years: (Record<string, number> & { year: number; repealed: number })[]
  largest: { sfs: string; title: string; sections: number }[]
}
type Article = {
  article_number: string
  title_en: string
  title_sv: string
  change_type: string
  amended_by: string[]
  applies_from: string
  applies_from_second: string | null
}
type Summary = {
  current_version: { celex: string; published_at: string }
  amended_by: { celex: string; published_at: string }[]
}
export type Law = { sfs: string; title: string; url: string }

/**
 * Allegora's selection, as the laws list in workers-ai/sfs/meta.json (6.8 MB, loaded only with
 * the corpus). ponytail: copied here so the list shows without the corpus; the corpus's own list
 * replaces it once loaded. Read it from a small laws.json when the export writes one.
 */
const SELECTION: [string, string][] = [
  ['1974:152', 'Regeringsformen'],
  ['1949:105', 'Tryckfrihetsförordningen'],
  ['1991:1469', 'Yttrandefrihetsgrundlagen'],
  ['1962:700', 'Brottsbalken'],
  ['1942:740', 'Rättegångsbalken'],
  ['1949:381', 'Föräldrabalken'],
  ['1958:637', 'Ärvdabalken'],
  ['1987:230', 'Äktenskapsbalken'],
  ['1970:994', 'Jordabalken'],
  ['2010:110', 'Socialförsäkringsbalken'],
  ['1915:218', 'Avtalslagen'],
  ['1990:931', 'Köplagen'],
  ['2022:260', 'Konsumentköplagen'],
  ['1985:716', 'Konsumenttjänstlagen'],
  ['2005:59', 'Distansavtalslagen'],
  ['1972:207', 'Skadeståndslagen'],
  ['1981:130', 'Preskriptionslagen'],
  ['2003:376', 'Sambolagen'],
  ['2010:1846', 'Konsumentkreditlagen'],
  ['2008:486', 'Marknadsföringslagen'],
  ['1960:729', 'Upphovsrättslagen'],
  ['1982:80', 'Lagen om anställningsskydd'],
  ['1982:673', 'Arbetstidslagen'],
  ['1977:480', 'Semesterlagen'],
  ['1976:580', 'Medbestämmandelagen'],
  ['1977:1160', 'Arbetsmiljölagen'],
  ['1995:584', 'Föräldraledighetslagen'],
  ['2008:567', 'Diskrimineringslagen'],
  ['2017:900', 'Förvaltningslagen'],
  ['2009:400', 'Offentlighets- och sekretesslagen'],
  ['2018:218', 'Dataskyddslagen'],
  ['2017:725', 'Kommunallagen'],
  ['2025:400', 'Socialtjänstlagen'],
  ['2010:800', 'Skollagen'],
  ['2010:900', 'Plan- och bygglagen'],
  ['2017:30', 'Hälso- och sjukvårdslagen'],
  ['2014:821', 'Patientlagen'],
  ['1993:387', 'LSS'],
  ['1984:387', 'Polislagen'],
  ['2018:1200', 'Kamerabevakningslagen'],
]
export const SELECTED: Law[] = SELECTION.map(([sfs, title]) => ({
  sfs,
  title,
  url: `https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/_sfs-${sfs.replace(':', '-')}/`,
}))

const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
const pct = (a: number, b: number) => `${Math.round((a / b) * 100)} %`
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString(l('en-GB', 'sv-SE'), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
/** CELEX 32026R1744 is Regulation (EU) 2026/1744. */
const regulation = (celex: string) =>
  `${l('Regulation', 'Förordning')} (EU) ${celex.slice(1, 5)}/${Number(celex.slice(6))}`

function useJson<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    fetchJson<T>(path).then(setData, () => {})
  }, [path])
  return data
}

/** In force and repealed per decade issued; the years before 1900 form one bar. */
function decades(years: Sfs['years']) {
  const rows = new Map<
    number,
    { decade: number; all: number; repealed: number }
  >()
  for (const y of years) {
    const decade = Math.max(1890, Math.floor(y.year / 10) * 10)
    const row = rows.get(decade) ?? { decade, all: 0, repealed: 0 }
    row.all += (y.lag ?? 0) + (y['förordning'] ?? 0) + (y.other ?? 0)
    row.repealed += y.repealed
    rows.set(decade, row)
  }
  return [...rows.values()].sort((a, b) => a.decade - b.decade)
}
const decadeName = (d: number) =>
  d === 1890 ? '–1899' : l(`${d}s`, `${d}-talet`)

function StatuteBook({ laws }: { laws: Law[] }) {
  const sfs = useJson<Sfs>('sfs/overview.json')
  if (!sfs) return null
  const all = sfs.kinds.reduce((s, k) => s + k.documents, 0)
  const repealed = sfs.kinds.reduce((s, k) => s + k.repealed, 0)
  const rows = decades(sfs.years)
  // The decade with the largest repealed share, among those with at least 100 texts.
  const peak = rows
    .filter((r) => r.all >= 100)
    .reduce((a, b) => (b.repealed / b.all > a.repealed / a.all ? b : a))
  const chosen = new Set(laws.map((x) => x.sfs))
  const [W, H, left, bottom, top] = [600, 210, 4, 22, 8]
  const max = Math.max(...rows.map((r) => r.all))
  const band = (W - left) / rows.length
  const y = (v: number) => ((H - bottom - top) * v) / max
  return (
    <section className="lq-data" aria-labelledby="lq-book-title">
      <h2 id="lq-book-title">{l('The statute book', 'Lagboken')}</h2>
      <p className="lq-lead">
        {l(
          `Every Swedish statute in the Riksdag's open data: ${num(all)} texts, of which ${num(repealed)} are repealed and ${num(all - repealed)} in force.`,
          `Varje svensk författning i Riksdagens öppna data: ${num(all)} texter, varav ${num(repealed)} är upphävda och ${num(all - repealed)} gäller.`,
        )}
      </p>
      <figure className="lq-figure">
        <figcaption className="lq-caption">
          <span className="lq-key lq-key-in" />
          {l('In force', 'Gäller')} <span className="lq-key lq-key-out" />
          {l('Repealed', 'Upphävda')}
          {' · '}
          {l('texts by decade issued', 'texter per årtionde de utfärdades')}
        </figcaption>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="lq-chart"
          role="img"
          aria-label={l(
            `Swedish statutes by decade issued, in force and repealed. Most repealed: the ${decadeName(peak.decade)}, ${pct(peak.repealed, peak.all)}.`,
            `Svenska författningar per årtionde, gällande och upphävda. Flest upphävda: ${decadeName(peak.decade)}, ${pct(peak.repealed, peak.all)}.`,
          )}
        >
          {rows.map((r, i) => {
            const x = left + i * band + band * 0.12
            const w = band * 0.76
            const base = H - bottom
            return (
              <g key={r.decade}>
                <title>
                  {`${decadeName(r.decade)}: ${num(r.all)}, ${l('repealed', 'upphävda')} ${num(r.repealed)}`}
                </title>
                <rect
                  className="lq-in"
                  x={x}
                  width={w}
                  y={base - y(r.all - r.repealed)}
                  height={y(r.all - r.repealed)}
                />
                <rect
                  className="lq-out"
                  x={x}
                  width={w}
                  y={base - y(r.all)}
                  height={y(r.repealed)}
                />
                {i % 2 === 0 && (
                  <text x={x + w / 2} y={H - 6} textAnchor="middle">
                    {decadeName(r.decade)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </figure>
      <div className="lq-about">
        <section aria-labelledby="lq-long-title">
          <h3 id="lq-long-title">
            {l('The longest statutes', 'De längsta författningarna')}
          </h3>
          <ol className="lq-long">
            {sfs.largest.map((x) => (
              <li key={x.sfs}>
                <span>{x.title}</span>{' '}
                <small>
                  {num(x.sections)} {l('sections', 'paragrafer')}
                  {chosen.has(x.sfs) && (
                    <b className="lq-mark">
                      {' '}
                      · {l('in Allegora', 'i Allegora')}
                    </b>
                  )}
                </small>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="lq-laws-title">
          <h3 id="lq-laws-title">
            {l(
              `The ${laws.length} laws in Allegora's selection`,
              `De ${laws.length} lagarna i Allegoras urval`,
            )}
          </h3>
          <ul className="lq-laws">
            {laws.map((law) => (
              <li key={law.sfs}>
                <a href={law.url}>{law.title}</a> <small>{law.sfs}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}

function AiAct() {
  const articles = useJson<Article[]>('ai-act/articles.json')
  const summary = useJson<Summary>('ai-act/summary.json')
  if (!articles || !summary) return null
  const today = new Date().toISOString().slice(0, 10)
  const dates = [...new Set(articles.map((a) => a.applies_from))].sort()
  const at = (d: string) => articles.filter((a) => a.applies_from === d)
  const changed = articles.filter((a) => a.amended_by.length > 0)
  const omnibus = summary.amended_by[0]
  const title = (a: Article) => l(a.title_en.replace(/'$/, ''), a.title_sv)
  const [W, H, bottom, top] = [600, 220, 40, 18]
  const max = Math.max(...dates.map((d) => at(d).length))
  const band = W / dates.length
  const y = (v: number) => ((H - bottom - top) * v) / max
  return (
    <section className="lq-data" aria-labelledby="lq-act-title">
      <h2 id="lq-act-title">{l('The AI Act', 'AI-förordningen')}</h2>
      <p className="lq-lead">
        {l(
          `Regulation (EU) 2024/1689 has ${articles.length} articles, read here in the consolidated text of ${day(summary.current_version.published_at)}.`,
          `Förordning (EU) 2024/1689 har ${articles.length} artiklar, här i den konsoliderade lydelsen från ${day(summary.current_version.published_at)}.`,
        )}
      </p>
      <figure className="lq-figure">
        <figcaption className="lq-caption">
          <span className="lq-key lq-key-in" />
          {l('Changed by', 'Ändrade genom')} {regulation(omnibus.celex)}{' '}
          <span className="lq-key lq-key-out" />
          {l('Unchanged', 'Oförändrade')}
          {' · '}
          {l(
            'articles by date of application',
            'artiklar per tillämpningsdatum',
          )}
        </figcaption>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="lq-chart"
          role="img"
          aria-label={l(
            `AI Act articles by the date they apply from: ${dates.map((d) => `${d}, ${at(d).length}`).join('; ')}.`,
            `AI-förordningens artiklar per tillämpningsdatum: ${dates.map((d) => `${d}, ${at(d).length}`).join('; ')}.`,
          )}
        >
          {dates.map((d, i) => {
            const n = at(d).length
            const c = at(d).filter((a) => a.amended_by.length > 0).length
            const x = i * band + band * 0.2
            const w = band * 0.6
            const base = H - bottom
            return (
              <g key={d} className={d > today ? 'lq-ahead' : undefined}>
                <title>
                  {`${day(d)}: ${n} ${l('articles', 'artiklar')}, ${c} ${l('changed', 'ändrade')}`}
                </title>
                <rect
                  className="lq-in"
                  x={x}
                  width={w}
                  y={base - y(c)}
                  height={y(c)}
                />
                <rect
                  className="lq-out"
                  x={x}
                  width={w}
                  y={base - y(n)}
                  height={y(n - c)}
                />
                <text x={x + w / 2} y={base - y(n) - 5} textAnchor="middle">
                  {n}
                </text>
                <text x={x + w / 2} y={H - 22} textAnchor="middle">
                  {d}
                </text>
                <text x={x + w / 2} y={H - 6} textAnchor="middle">
                  {d > today ? l('ahead', 'framöver') : l('applies', 'gäller')}
                </text>
              </g>
            )
          })}
        </svg>
      </figure>
      <section aria-labelledby="lq-changed-title">
        <h3 id="lq-changed-title">
          {l(
            `The ${changed.length} articles changed`,
            `De ${changed.length} ändrade artiklarna`,
          )}
        </h3>
        <ul className="lq-articles">
          {changed.map((a) => (
            <li key={a.article_number}>
              <b>{a.article_number}</b> {title(a)}
              {a.change_type === 'inserted' && (
                <small> · {l('new', 'ny')}</small>
              )}
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

export default function LawData({ laws }: { laws: Law[] }) {
  return (
    <>
      <StatuteBook laws={laws.length ? laws : SELECTED} />
      <AiAct />
    </>
  )
}
