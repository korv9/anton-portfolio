/**
 * Skatter: Sweden's taxes against the other OECD countries, every kind of tax at once. Share of
 * GDP from OECD Revenue Statistics (general government). One strip per tax shows where Sweden
 * sits among the countries, a stacked bar per country shows each country's tax mix, a line
 * follows Sweden and the comparison group over time, and a table holds the figures.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import MultiLineChart from '../../charts/MultiLineChart'
import { fetchJson } from '../../welfare/data'
import TaxBubbles from '../features/TaxBubbles'
import type { Route } from '../../router'
import { Board, Card, Cards, Empty, Kpi, Kpis } from '../board/Board'
import { Select, num, pct } from '../controls'
import { useViewParams } from '../useViewParams'
import './skatter.css'

type TaxType = {
  tax_code: string
  name_sv: string
  name_en: string
  parent_code: string | null
  note_sv: string | null
}
type Country = {
  country_code: string
  name_sv: string
  name_en: string
  is_nordic: boolean
  is_eu: boolean
}
type Countries = {
  types: TaxType[]
  countries: Country[]
  rows: [string, number, string, number][]
  source: string
}

/** The pieces a country's total is made of, in a fixed order and colour. */
const MIX: { code: string; en: string; sv: string; color: string }[] = [
  {
    code: 'T_1100',
    en: 'Personal income',
    sv: 'Inkomstskatt',
    color: '#1f5f8b',
  },
  { code: 'T_1200', en: 'Corporate', sv: 'Bolagsskatt', color: '#6aa6d6' },
  {
    code: 'T_1000x',
    en: 'Other income',
    sv: 'Övrig inkomst',
    color: '#b9d3e8',
  },
  {
    code: 'T_2000',
    en: 'Social security',
    sv: 'Socialavgifter',
    color: '#2c7a4b',
  },
  { code: 'T_3000', en: 'Payroll', sv: 'Löneskatter', color: '#8cc084' },
  { code: 'T_4000', en: 'Property', sv: 'Egendom', color: '#b07a2a' },
  { code: 'T_5111', en: 'VAT', sv: 'Moms', color: '#c8553d' },
  { code: 'T_5000x', en: 'Other goods', sv: 'Övriga varor', color: '#eaa58f' },
  { code: 'T_6000', en: 'Other', sv: 'Övrigt', color: '#9aa3a8' },
]

const GROUPS = [
  { value: 'oecd', en: 'All OECD', sv: 'Hela OECD' },
  { value: 'eu', en: 'EU countries', sv: 'EU-länder' },
  { value: 'nordic', en: 'Nordic countries', sv: 'Norden' },
]

const AGGREGATES: Record<string, true> = { OECD_REP: true, EU22OECD: true }

const DEFAULTS = { ar: '', grupp: 'oecd', skatt: '_T' }

export default function SkatterTheme({ route }: { route: Route }) {
  const [data, setData] = useState<Countries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useViewParams(route, DEFAULTS)
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Countries>('taxes/countries.json')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  const model = useMemo(() => {
    if (!data) return null
    // value[country][year][code]
    const value = new Map<string, Map<number, Map<string, number>>>()
    for (const [c, y, code, v] of data.rows) {
      if (!value.has(c)) value.set(c, new Map())
      const years = value.get(c)!
      if (!years.has(y)) years.set(y, new Map())
      years.get(y)!.set(code, v)
    }
    // Years with Sweden and most countries: a fair comparison.
    const counts = new Map<number, number>()
    for (const [, y, code] of data.rows)
      if (code === '_T') counts.set(y, (counts.get(y) ?? 0) + 1)
    const years = [...counts.entries()]
      .filter(([y, n]) => n >= 30 && value.get('SWE')?.has(y))
      .map(([y]) => y)
      .sort((a, b) => b - a)
    return { value, years }
  }, [data])

  if (error) return <p className="theme-error">{error}</p>
  if (!data || !model) return <Empty />

  const year = Number(view.ar) || model.years[0]
  const byCode = new Map(data.types.map((t) => [t.tax_code, t]))
  // The source's own averages are aggregates, not countries.
  const members = data.countries
    .filter((c) => !AGGREGATES[c.country_code])
    .filter((c) =>
      view.grupp === 'eu'
        ? c.is_eu || c.country_code === 'SWE'
        : view.grupp === 'nordic'
          ? c.is_nordic
          : true,
    )
  const get = (country: string, code: string, y = year) => {
    const row = model.value.get(country)?.get(y)
    if (!row) return null
    if (code === 'T_1000x')
      return Math.max(
        0,
        (row.get('T_1000') ?? 0) -
          (row.get('T_1100') ?? 0) -
          (row.get('T_1200') ?? 0),
      )
    if (code === 'T_5000x')
      return Math.max(0, (row.get('T_5000') ?? 0) - (row.get('T_5111') ?? 0))
    return row.get(code) ?? null
  }
  const present = members.filter((c) => get(c.country_code, '_T') != null)
  const name = (c: Country) => l(c.name_en, c.name_sv)
  const typeName = (code: string) => {
    const t = byCode.get(code)
    return t ? l(t.name_en, t.name_sv) : code
  }
  const mean = (code: string, y = year) => {
    // The published OECD and EU averages where the source has them.
    const published = { oecd: 'OECD_REP', eu: 'EU22OECD' }[view.grupp]
    const official = published ? get(published, code, y) : null
    if (official != null) return official
    const values = members
      .map((c) => get(c.country_code, code, y))
      .filter((v): v is number => v != null)
    return values.length
      ? values.reduce((s, v) => s + v, 0) / values.length
      : null
  }
  const rankOf = (code: string) => {
    const sorted = present
      .map((c) => get(c.country_code, code) ?? 0)
      .sort((a, b) => b - a)
    const swe = get('SWE', code)
    return swe == null ? null : sorted.indexOf(swe) + 1
  }
  const groupLabel = l(
    ...((
      {
        oecd: ['the OECD average', 'OECD-snittet'],
        eu: ['the EU average', 'EU-snittet'],
        nordic: ['the Nordic average', 'snittet i Norden'],
      } as Record<string, [string, string]>
    )[view.grupp] ?? ['the average', 'snittet']),
  )

  const types = data.types.map((t) => t.tax_code)
  const sweTotal = get('SWE', '_T') ?? 0
  const avgTotal = mean('_T') ?? 0
  const top = [...present].sort(
    (a, b) =>
      (get(b.country_code, '_T') ?? 0) - (get(a.country_code, '_T') ?? 0),
  )[0]

  // The mix per country, largest total first.
  const mixRows = [...present]
    .map((c) => ({
      country: c,
      total: get(c.country_code, '_T') ?? 0,
      parts: MIX.map((m) => get(c.country_code, m.code) ?? 0),
    }))
    .sort((a, b) => b.total - a.total)
  const mixMax = Math.max(...mixRows.map((r) => r.total), 1)

  const chosen = view.skatt
  const overTime = [
    {
      key: 'SWE',
      name: l('Sweden', 'Sverige'),
      points: model.years
        .slice()
        .reverse()
        .map((y) => ({ y, v: get('SWE', chosen, y) }))
        .filter((p): p is { y: number; v: number } => p.v != null)
        .map((p) => ({ date: `${p.y}-07-01`, label: String(p.y), value: p.v })),
    },
    {
      key: 'avg',
      name: l('Average', 'Snitt'),
      points: model.years
        .slice()
        .reverse()
        .map((y) => ({ y, v: mean(chosen, y) }))
        .filter((p): p is { y: number; v: number } => p.v != null)
        .map((p) => ({ date: `${p.y}-07-01`, label: String(p.y), value: p.v })),
    },
  ]

  return (
    <Board
      title={l(
        'How do Sweden’s taxes compare?',
        'Hur står sig Sveriges skatter?',
      )}
      sub={l(
        `Every kind of tax as a share of GDP, ${year}. Sweden against ${present.length} countries. Hover a dot to see the country.`,
        `Varje typ av skatt som andel av BNP, ${year}. Sverige mot ${present.length} länder. Hovra över en punkt för att se landet.`,
      )}
      slicers={
        <>
          <Select
            label={l('Year', 'År')}
            value={String(year)}
            options={model.years.map((y) => ({
              value: String(y),
              label: String(y),
            }))}
            onChange={(v) =>
              setView({ ar: v === String(model.years[0]) ? '' : v })
            }
          />
          <Select
            label={l('Compare with', 'Jämför med')}
            value={view.grupp}
            options={GROUPS.map((g) => ({
              value: g.value,
              label: l(g.en, g.sv),
            }))}
            onChange={(v) => setView({ grupp: v })}
          />
        </>
      }
    >
      <TaxBubbles />
      <Kpis>
        <Kpi
          index={0}
          label={l('Sweden, all taxes', 'Sverige, alla skatter')}
          value={sweTotal}
          format={(v) => pct(v)}
          sub={l('of GDP', 'av BNP')}
        />
        <Kpi
          index={1}
          label={l('Place', 'Placering')}
          value={rankOf('_T') ?? 0}
          format={(v) => `${num(v)} / ${present.length}`}
          sub={l('highest first', 'högst först')}
        />
        <Kpi
          index={3}
          label={l('Sweden against the average', 'Sverige mot snittet')}
          value={sweTotal - avgTotal}
          format={(v) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), 1)} p.e.`}
          sub={l('percentage points of GDP', 'procentenheter av BNP')}
        />
        {top && (
          <Kpi
            index={4}
            label={l('Highest', 'Högst')}
            value={get(top.country_code, '_T') ?? 0}
            format={(v) => pct(v)}
            sub={name(top)}
          />
        )}
      </Kpis>

      <Cards>
        <Card
          wide
          index={0}
          title={l(
            'Every tax: where Sweden sits among the countries',
            'Varje skatt: var Sverige ligger bland länderna',
          )}
          meta={l(
            `Share of GDP. Each dot is a country; Sweden is the large dot, the line is ${groupLabel}. Click a row to follow it over time.`,
            `Andel av BNP. Varje punkt är ett land; Sverige är den stora punkten, strecket är ${groupLabel}. Klicka på en rad för att följa den över tid.`,
          )}
        >
          <ol className="tax-strips">
            {types.map((code) => {
              const values = present
                .map((c) => ({ c, v: get(c.country_code, code) }))
                .filter((x): x is { c: Country; v: number } => x.v != null)
              const max = Math.max(...values.map((x) => x.v), 0.1)
              const swe = get('SWE', code)
              const avg = mean(code)
              const at = (v: number) => `${(v / max) * 100}%`
              const rank = rankOf(code)
              return (
                <li
                  key={code}
                  className={`tax-strip${chosen === code ? ' chosen' : ''}${code === '_T' ? ' total' : ''}${byCode.get(code)?.parent_code && byCode.get(code)?.parent_code !== '_T' ? ' sub' : ''}`}
                >
                  <button
                    type="button"
                    className="tax-strip-name"
                    aria-pressed={chosen === code}
                    onClick={() => setView({ skatt: code })}
                  >
                    {typeName(code)}
                  </button>
                  <div
                    className="tax-strip-track"
                    role="img"
                    aria-label={l(
                      `${typeName(code)}: Sweden ${pct(swe ?? 0)}, place ${rank} of ${values.length}`,
                      `${typeName(code)}: Sverige ${pct(swe ?? 0)}, plats ${rank} av ${values.length}`,
                    )}
                  >
                    {avg != null && (
                      <span className="tax-avg" style={{ left: at(avg) }} />
                    )}
                    {values.map(({ c, v }) =>
                      c.country_code === 'SWE' ? null : (
                        <span
                          key={c.country_code}
                          className={`round tax-dot${c.is_nordic ? ' nordic' : ''}${hover === c.country_code ? ' hover' : ''}`}
                          style={{ left: at(v) }}
                          title={`${name(c)} ${pct(v)}`}
                          onMouseEnter={() => setHover(c.country_code)}
                          onMouseLeave={() => setHover(null)}
                        />
                      ),
                    )}
                    {swe != null && (
                      <span
                        className="round tax-dot swe"
                        style={{ left: at(swe) }}
                      >
                        <b>{pct(swe)}</b>
                      </span>
                    )}
                    <span className="tax-max">{pct(max)}</span>
                  </div>
                  <span className="tax-rank">
                    {rank ? `${rank}/${values.length}` : '—'}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="tax-legend">
            <span className="round tax-dot swe" /> {l('Sweden', 'Sverige')}
            <span className="round tax-dot nordic" /> {l('Nordic', 'Norden')}
            <span className="round tax-dot" />{' '}
            {l('Other countries', 'Övriga länder')}
            <span className="tax-avg" /> {groupLabel}
            {hover && (
              <strong className="tax-hover">
                {name(data.countries.find((c) => c.country_code === hover)!)}
              </strong>
            )}
          </p>
        </Card>

        <Card
          index={1}
          title={l(
            'The tax mix, country by country',
            'Skattemixen, land för land',
          )}
          meta={l(
            'Share of GDP, largest total first. Each colour is a kind of tax.',
            'Andel av BNP, störst totalt först. Varje färg är en typ av skatt.',
          )}
        >
          <ul className="tax-mix-legend">
            {MIX.map((m) => (
              <li key={m.code}>
                <i style={{ background: m.color }} />
                {l(m.en, m.sv)}
              </li>
            ))}
          </ul>
          <ol
            className="tax-mix"
            tabIndex={0}
            aria-label={l('Tax mix per country', 'Skattemix per land')}
          >
            {mixRows.map((row) => (
              <li
                key={row.country.country_code}
                className={
                  row.country.country_code === 'SWE' ? 'swe' : undefined
                }
              >
                <span className="tax-mix-name">{name(row.country)}</span>
                <span
                  className="tax-mix-bar"
                  style={{ width: `${(row.total / mixMax) * 100}%` }}
                  title={`${name(row.country)} ${pct(row.total)}`}
                >
                  {row.parts.map((v, i) =>
                    v > 0 ? (
                      <i
                        key={MIX[i].code}
                        style={{
                          flexGrow: v,
                          background: MIX[i].color,
                        }}
                        title={`${l(MIX[i].en, MIX[i].sv)} ${pct(v)}`}
                      />
                    ) : null,
                  )}
                </span>
                <span className="tax-mix-total">{num(row.total, 1)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card
          index={2}
          title={l(
            `${typeName(chosen)} over time`,
            `${typeName(chosen)} över tid`,
          )}
          meta={l(
            `Sweden and ${groupLabel}, share of GDP. Choose another tax in the strips above.`,
            `Sverige och ${groupLabel}, andel av BNP. Välj en annan skatt i raderna ovan.`,
          )}
        >
          <MultiLineChart
            series={overTime}
            label={l('Share of GDP', 'Andel av BNP')}
            format={(v) => pct(v)}
            colorOf={(key) => (key === 'SWE' ? '#16181b' : '#6aa6d6')}
          />
        </Card>

        <Card
          wide
          index={3}
          title={l('All the figures', 'Alla siffror')}
          meta={l(
            `Share of GDP, ${year}. Place among ${present.length} countries, highest first.`,
            `Andel av BNP, ${year}. Plats bland ${present.length} länder, högst först.`,
          )}
          href="#taxes"
          more={l('Tax calculator and decisions', 'Skatteräknare och beslut')}
        >
          <div className="tax-table-wrap">
            <table className="tax-table">
              <thead>
                <tr>
                  <th scope="col">{l('Tax', 'Skatt')}</th>
                  <th scope="col">{l('Sweden', 'Sverige')}</th>
                  <th scope="col">{l('Average', 'Snitt')}</th>
                  <th scope="col">{l('Difference', 'Skillnad')}</th>
                  <th scope="col">{l('Place', 'Plats')}</th>
                </tr>
              </thead>
              <tbody>
                {types.map((code) => {
                  const swe = get('SWE', code)
                  const avg = mean(code)
                  const diff = swe != null && avg != null ? swe - avg : null
                  return (
                    <tr key={code}>
                      <th scope="row">{typeName(code)}</th>
                      <td>{swe == null ? '—' : pct(swe)}</td>
                      <td>{avg == null ? '—' : pct(avg)}</td>
                      <td
                        className={diff == null ? '' : diff > 0 ? 'up' : 'down'}
                      >
                        {diff == null
                          ? '—'
                          : `${diff >= 0 ? '+' : '−'}${num(Math.abs(diff), 1)}`}
                      </td>
                      <td>{rankOf(code) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="dash-meta">
            {l('Source', 'Källa')}:{' '}
            <a
              href="https://www.oecd.org/en/topics/sub-issues/tax-revenue-statistics.html"
              target="_blank"
              rel="noreferrer"
            >
              {data.source} ↗
            </a>
          </p>
        </Card>
      </Cards>
    </Board>
  )
}
