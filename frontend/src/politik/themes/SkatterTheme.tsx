/**
 * Skatter: Sweden's taxes against the other OECD countries, every kind of tax at once. Share of
 * GDP from OECD Revenue Statistics (general government). One strip per tax shows where Sweden
 * sits among the countries, a stacked bar per country shows each country's tax mix, a line
 * follows Sweden and the comparison group over time, and a table holds the figures.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { Dumbbell } from '../../charts/Compare'
import MultiLineChart from '../../charts/MultiLineChart'
import type { Route } from '../../router'
import { Board, Card, Cards, Empty } from '../board/Board'
import { Select, num, pct } from '../controls'
import { useViewParams } from '../useViewParams'
import '../../taxes/taxes.css'
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
  // The countries Sweden is most often set beside.
  const beside = ['DNK', 'NOR', 'FIN', 'DEU'].flatMap((code) =>
    data.countries.filter((c) => c.country_code === code),
  )

  return (
    <Board
      level={2}
      title={l('Taxes', 'Skatter')}
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
      <Cards>
        <Card
          index={5}
          title={l(`Sweden against ${groupLabel}`, `Sverige mot ${groupLabel}`)}
          meta={l(
            `Share of GDP per kind of tax, ${year}`,
            `Andel av BNP per skattetyp, ${year}`,
          )}
        >
          <Dumbbell
            rows={types.flatMap((code) => {
              const swe = get('SWE', code)
              const avg = mean(code)
              return swe == null || avg == null
                ? []
                : [{ key: code, label: typeName(code), from: avg, to: swe }]
            })}
            fromLabel={groupLabel}
            toLabel={l('Sweden', 'Sverige')}
            format={(v) => pct(v)}
            label={l(
              `Sweden and ${groupLabel} per kind of tax, share of GDP`,
              `Sverige och ${groupLabel} per skattetyp, andel av BNP`,
            )}
          />
        </Card>
        <Card
          index={6}
          title={l('All taxes over time', 'Alla skatter över tid')}
          meta={l(
            `Total tax revenue as a share of GDP, Sweden and ${groupLabel}`,
            `Totala skatteintäkter som andel av BNP, Sverige och ${groupLabel}`,
          )}
        >
          <MultiLineChart
            series={[
              { key: 'SWE', name: l('Sweden', 'Sverige'), of: get },
              {
                key: 'avg',
                name: groupLabel,
                of: (_: string, code: string, y: number) => mean(code, y),
              },
            ].map(({ key, name, of }) => ({
              key,
              name,
              points: [...model.years].reverse().flatMap((y) => {
                const v = of('SWE', '_T', y)
                return v == null
                  ? []
                  : [{ date: `${y}-07-01`, label: String(y), value: v }]
              }),
            }))}
            format={(v) => pct(v)}
            colorOf={(key) => (key === 'SWE' ? 1 : 2)}
            label={l(
              'Total tax revenue as a share of GDP over time',
              'Totala skatteintäkter som andel av BNP över tid',
            )}
          />
        </Card>
        <Card
          wide
          index={3}
          title={l(
            'Sweden’s taxes beside its neighbours',
            'Sveriges skatter bredvid grannländerna',
          )}
          meta={l(
            `Share of GDP, ${year}. Place among ${present.length} countries, highest first.`,
            `Andel av BNP, ${year}. Plats bland ${present.length} länder, högst först.`,
          )}
        >
          <div
            className="tax-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={l(
              'Tax comparison table',
              'Tabell för skattejämförelse',
            )}
          >
            <table className="tax-table">
              <thead>
                <tr>
                  <th scope="col">{l('Tax', 'Skatt')}</th>
                  <th scope="col" className="swe">
                    {l('Sweden', 'Sverige')}
                  </th>
                  {beside.map((c) => (
                    <th scope="col" key={c.country_code}>
                      {name(c)}
                    </th>
                  ))}
                  <th scope="col">{groupLabel}</th>
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
                    <tr key={code} className={code === '_T' ? 'total' : ''}>
                      <th scope="row">{typeName(code)}</th>
                      <td className="swe">{swe == null ? '–' : pct(swe)}</td>
                      {beside.map((c) => {
                        const v = get(c.country_code, code)
                        return (
                          <td key={c.country_code}>
                            {v == null ? '–' : pct(v)}
                          </td>
                        )
                      })}
                      <td>{avg == null ? '–' : pct(avg)}</td>
                      <td
                        className={diff == null ? '' : diff > 0 ? 'up' : 'down'}
                      >
                        {diff == null
                          ? '–'
                          : `${diff >= 0 ? '+' : '−'}${num(Math.abs(diff), 1)}`}
                      </td>
                      <td>{rankOf(code) ?? '–'}</td>
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
              {data.source}
            </a>
          </p>
        </Card>
      </Cards>
    </Board>
  )
}
