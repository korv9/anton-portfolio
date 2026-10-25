/**
 * E — The Lost Futures, the Explore views: theme trends with speech length, the academic corpus
 * shown apart, the parties compared, the patterns and source-linked speeches.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../i18n'
import { fetchJson } from '../dataSource'
import MultiLineChart from '../charts/MultiLineChart'
import RankBars from '../charts/RankBars'
import FuturesJump, { type Jump } from './FuturesJump'
import FuturesMeasures from './FuturesMeasures'

/** year, speeches, future speeches, words, future speeches using it, matches, share, per 1,000 words */
export type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]
export type Theme = {
  id: string
  label_en: string
  label_sv: string
  description_en: string
  pattern: string
  rows: Row[]
  /** A linear trend plus one level shift, tested against AR(1) noise around the trend (Holm over
   * the nine themes); the year and shift are null unless the shift beats the null. */
  break: {
    first_year_after: number | null
    shift: number | null
    gain: number
    null_p95: number
    p: number
    p_holm: number
    reported: boolean
  } | null
}
/** year, future-oriented speeches using it, matches, share of future-oriented speeches */
export type Subterm = {
  id: string
  theme: string
  label_en: string
  label_sv: string
  pattern: string
  rows: [number, number, number, number][]
}
export type Trends = {
  marker: {
    label_en: string
    label_sv: string
    description_en: string
    pattern: string
  }
  themes: Theme[]
  /** year, share of all speeches, words per speech, marker matches per 1,000 words (null until counted) */
  future_share: [number, number, number?, (number | null)?][]
  length?: { spearman_share_words_per_speech: number; years: number }
  /** Future share per year within four length bands (band 0 shortest); standardised to the
   * pooled band mix. */
  length_bands?: {
    upper_words: number[]
    rows: [number, number, number, number][]
    standardised: [number, number][]
  }
  subterms?: Subterm[]
  /** Swedish thesis abstracts (DiVA): year, share of future-oriented abstracts, abstracts. */
  academic?: {
    corpus: string
    future_share: [number, number, number][]
    themes: Record<string, [number, number, number][]>
    jump?: Jump | null
  } | null
}
export type Cells = { rows: [string, string, number, number, number][] }
export type Examples = { rows: string[][] }

export const BASE = 'sweden/futures/'
// DiVA years whose rise in the future share gets a scope note while the per-word counts
// (academic.jump) are absent.
const UNEXPLAINED = [2024, 2025]
export const pct = (v: number) => `${(v * 100).toFixed(1)} %`
export const num = (n: number) => n.toLocaleString(l('en-GB', 'sv-SE'))
export const name = (t: { label_en: string; label_sv: string }) =>
  l(t.label_en, t.label_sv)

export default function Explore({
  themes,
  trends,
  years,
  picked,
  onPick,
}: {
  themes: Theme[]
  trends: Trends
  years: number[]
  picked: string | null
  onPick: (theme: string) => void
}) {
  const [parties, setParties] = useState<Cells | null>(null)
  const [examples, setExamples] = useState<Examples | null>(null)
  const theme = picked ?? themes[0].id
  const last = years[years.length - 1]
  const [year, setYear] = useState(last)
  useEffect(() => {
    fetchJson<Cells>(BASE + 'parties.json').then(setParties, () => {})
    fetchJson<Examples>(BASE + 'examples.json').then(setExamples, () => {})
  }, [])
  const lines = useMemo(() => {
    const keys = [...new Set([theme, ...themes.map((t) => t.id)])]
    return [
      {
        key: '_future',
        name: l(
          'Speeches about the future (share of all)',
          'Anföranden om framtiden (andel av alla)',
        ),
        points: trends.future_share.map(([y, v]) => ({
          date: `${y}-01-01`,
          label: String(y),
          value: v * 100,
        })),
      },
      ...keys.slice(0, 4).map((k) => {
        const t = themes.find((x) => x.id === k)!
        return {
          key: k,
          name: name(t),
          points: t.rows.map((r) => ({
            date: `${r[0]}-01-01`,
            label: String(r[0]),
            value: r[6] * 100,
          })),
        }
      }),
    ]
  }, [themes, trends, theme])
  const t = themes.find((x) => x.id === theme)!
  const share = new Map(trends.future_share.map((r) => [r[0], r]))
  const byParty = (parties?.rows ?? [])
    .filter((r) => r[1] === theme && r[2] === year)
    .map((r) => ({
      key: r[0],
      label: r[0],
      party: r[0],
      value: r[4] / r[3],
      note: `${num(r[4])} / ${num(r[3])}`,
    }))
    .sort((a, b) => b.value - a.value)
  return (
    <>
      <div className="sw-controls">
        <label>
          {l('Theme', 'Tema')}
          <select value={theme} onChange={(e) => onPick(e.target.value)}>
            {themes.map((x) => (
              <option key={x.id} value={x.id}>
                {name(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3>{l('Share per year (%)', 'Andel per år (%)')}</h3>
      <MultiLineChart
        series={lines}
        label={l(
          'Future talk and themes per year',
          'Framtidstal och teman per år',
        )}
        format={(v) => `${v.toFixed(1)} %`}
        colorOf={(k) => lines.findIndex((s) => s.key === k) + 1}
        yFrom={0}
      />
      <div className="sw-table-wrap">
        <table className="sw-table">
          <caption>
            {l(
              'Share of future-oriented speeches using each theme, every year',
              'Andel framtidsinriktade anföranden som använder varje tema, varje år',
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l('Year', 'År')}</th>
              <th scope="col" className="sw-n">
                {l('About the future', 'Om framtiden')}
              </th>
              <th scope="col" className="sw-n">
                {l('Words per speech', 'Ord per anförande')}
              </th>
              {themes.map((x) => (
                <th key={x.id} scope="col" className="sw-n">
                  {name(x)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <th scope="row">{y}</th>
                <td className="sw-n">{pct(share.get(y)?.[1] ?? 0)}</td>
                <td className="sw-n">
                  {Math.round(share.get(y)?.[2] ?? 0) || '–'}
                </td>
                {themes.map((x) => {
                  const r = x.rows.find((q) => q[0] === y)
                  return (
                    <td key={x.id} className="sw-n">
                      {r ? pct(r[6]) : '–'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.break && (
        <p className="sw-note">
          {t.break.reported && t.break.first_year_after != null
            ? l(
                `A level shift on top of the trend from ${t.break.first_year_after}: ${t.break.shift! > 0 ? '+' : ''}${(t.break.shift! * 100).toFixed(1)} percentage points. It removes ${Math.round(t.break.gain * 100)} % of the variation the trend leaves, more than in 95 % of simulated series with the same trend and noise (Holm-adjusted p ${t.break.p_holm}).`,
                `Ett nivåskifte ovanpå trenden från ${t.break.first_year_after}: ${t.break.shift! > 0 ? '+' : ''}${(t.break.shift! * 100).toFixed(1)} procentenheter. Det tar bort ${Math.round(t.break.gain * 100)} % av variationen som trenden lämnar, mer än i 95 % av simulerade serier med samma trend och brus (Holm-justerat p ${t.break.p_holm}).`,
              )
            : l(
                `No level shift beyond the trend: the best one removes ${Math.round(t.break.gain * 100)} % of the variation the trend leaves, within what simulated series with the same trend and noise reach (Holm-adjusted p ${t.break.p_holm}).`,
                `Inget nivåskifte utöver trenden: det bästa tar bort ${Math.round(t.break.gain * 100)} % av variationen som trenden lämnar, inom vad simulerade serier med samma trend och brus når (Holm-justerat p ${t.break.p_holm}).`,
              )}
        </p>
      )}
      <FuturesMeasures trends={trends} theme={theme} />
      {trends.academic && trends.academic.future_share.length > 1 && (
        <>
          <h3>
            {l(
              'The academic corpus, shown apart (%)',
              'Den akademiska korpusen, visad för sig (%)',
            )}
          </h3>
          <p className="sw-note">
            {trends.academic.corpus}.{' '}
            {l(
              'Another genre with other authors and another length: compare the direction of the lines, not their level, and never add them to the Riksdag’s.',
              'En annan genre med andra författare och annan längd: jämför linjernas riktning, inte deras nivå, och lägg dem aldrig ihop med riksdagens.',
            )}
          </p>
          <MultiLineChart
            series={[
              {
                key: '_future',
                name: l(
                  'Abstracts about the future',
                  'Sammanfattningar om framtiden',
                ),
                points: trends.academic.future_share.map(([y, v, n]) => ({
                  date: `${y}-01-01`,
                  label: `${y} (${num(n)})`,
                  value: v * 100,
                })),
              },
              {
                key: theme,
                name: name(t),
                points: (trends.academic.themes[theme] ?? []).map(([y, v]) => ({
                  date: `${y}-01-01`,
                  label: String(y),
                  value: v * 100,
                })),
              },
            ]}
            label={l(
              'Future themes in thesis abstracts',
              'Framtidsteman i uppsatssammanfattningar',
            )}
            format={(v) => `${v.toFixed(1)} %`}
            colorOf={(k) => (k === '_future' ? 1 : 2)}
            yFrom={0}
          />
          {trends.academic.jump ? (
            <FuturesJump jump={trends.academic.jump} />
          ) : (
            trends.academic.future_share.some(([y]) =>
              UNEXPLAINED.includes(y),
            ) && (
              <p className="sw-note">
                {l(
                  `The rise in ${UNEXPLAINED.join(' and ')} is shown as counted. This harvest records whether an abstract uses the future marker, not which of its words, so the rise is not attributed to particular words.`,
                  `Ökningen ${UNEXPLAINED.join(' och ')} visas som den räknats. Den här skörden registrerar om en sammanfattning använder framtidsmarkören, inte vilka av dess ord, så ökningen tillskrivs inte särskilda ord.`,
                )}
              </p>
            )
          )}
        </>
      )}
      <h3>{l(`By party, ${year}`, `Per parti, ${year}`)}</h3>
      <div className="sw-controls">
        <label>
          {l('Year', 'År')}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {byParty.length ? (
        <RankBars
          rows={byParty}
          format={pct}
          max={1}
          label={l(`${name(t)} by party`, `${name(t)} per parti`)}
        />
      ) : (
        <p className="sw-note">
          {l(
            'No party with 50 or more future-oriented speeches that year.',
            'Inget parti med 50 eller fler framtidsinriktade anföranden det året.',
          )}
        </p>
      )}
      <h3>
        {l(
          'The patterns and source-linked speeches',
          'Mönstren och länkade anföranden',
        )}
      </h3>
      <p className="sw-note">
        {l('Future marker', 'Framtidsmarkör')}:{' '}
        <code className="sw-mono">{trends.marker.pattern}</code>
      </p>
      <p className="sw-note">{t.description_en}</p>
      <pre className="sw-mono sw-pattern">{t.pattern}</pre>
      {examples && (
        <ul className="sw-examples">
          {examples.rows
            .filter((r) => r[0] === theme)
            .slice(-12)
            .map((r) => (
              <li key={r[5]}>
                <span className="sw-mono">
                  {r[2]} · {r[3] ?? '–'} · {r[4]}
                </span>{' '}
                <q>{r[7]}</q> <a href={r[5]}>{l('Speech', 'Anförande')}</a>
              </li>
            ))}
        </ul>
      )}
    </>
  )
}
