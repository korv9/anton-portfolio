/**
 * Every Swedish tax ranked by the money it brings in, with its share of all taxes. Pick a year
 * to see the mix change (the wealth tax is there until 2007). The table adds share of GDP.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { Feature, Pick } from '../../charts/feature/Feature'
import RankBars from '../../charts/RankBars'
import { num, pct } from '../controls'
import './features.css'

type TaxType = {
  tax_code: string
  name_sv: string
  name_en: string
  parent_code: string | null
}
type Sweden = {
  types: TaxType[]
  rows: [number, string, number | null, number | null][]
}
export default function TaxRanking() {
  const [data, setData] = useState<Sweden | null>(null)
  const [year, setYear] = useState<string | null>(null)
  useEffect(() => {
    fetchJson<Sweden>('taxes/sweden.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  const years = useMemo(
    () =>
      [
        ...new Set(
          (data?.rows ?? []).filter((r) => r[3] != null).map((r) => r[0]),
        ),
      ].sort((a, b) => a - b),
    [data],
  )
  if (!data || !years.length) return null
  const latest = years.at(-1)!
  const choices = [latest, 2006, 1990, years[0]].filter(
    (y, i, a) => years.includes(y) && a.indexOf(y) === i,
  )
  const shown =
    Number(year) && years.includes(Number(year)) ? Number(year) : latest
  const value = (code: string, i: 2 | 3) =>
    data.rows.find((r) => r[0] === shown && r[1] === code)?.[i] ?? null
  const name = (t: TaxType) => l(t.name_en, t.name_sv)
  const groups = data.types.filter((t) => t.parent_code === '_T')
  const childrenOf = (code: string) =>
    data.types.filter((t) => t.parent_code === code)
  const leaves = (code: string): TaxType[] => {
    const kids = childrenOf(code)
    return kids.length
      ? kids.flatMap((k) => leaves(k.tax_code))
      : [data.types.find((t) => t.tax_code === code)!]
  }
  const total = value('_T', 3) ?? 0
  const all = groups
    .flatMap((g) =>
      leaves(g.tax_code).map((t) => ({ t, sek: value(t.tax_code, 3) ?? 0 })),
    )
    .filter((x) => x.sek > 0)
  const top2 = [...all].sort((a, b) => b.sek - a.sek).slice(0, 2)
  const gone = childrenOf('T_4000').filter(
    (t) => (value(t.tax_code, 3) ?? 0) === 0,
  )

  return (
    <Feature
      id="skattebubblor"
      title={l(
        `${name(top2[0].t)} and ${name(top2[1].t).toLowerCase()} bring in ${pct(((top2[0].sek + top2[1].sek) / total) * 100, 0)} of all taxes in ${shown}.`,
        `${name(top2[0].t)} och ${name(top2[1].t).toLowerCase()} står för ${pct(((top2[0].sek + top2[1].sek) / total) * 100, 0)} av alla skatter ${shown}.`,
      )}
      lead={l(
        `Every tax ranked by the money it brought in (${num(total, 0)} bn SEK in all). Pick a year to see the mix change${gone.length ? `; in ${shown} ${gone.map((t) => name(t).toLowerCase()).join(' and ')} brought in nothing` : ''}.`,
        `Varje skatt rangordnad efter pengarna den drog in (${num(total, 0)} mdkr totalt). Välj ett år för att se hur mixen ändras${gone.length ? `; ${shown} drog ${gone.map((t) => name(t).toLowerCase()).join(' och ')} in noll` : ''}.`,
      )}
      controls={
        <Pick
          label={l('Year', 'År')}
          value={String(shown)}
          options={choices.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={setYear}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Tax', 'Skatt')}</th>
              <th className="num">{l('SEK bn', 'Mdkr')}</th>
              <th className="num">{l('% of GDP', '% av BNP')}</th>
              <th className="num">{l('% of taxes', '% av skatterna')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              leaves(g.tax_code).map((t) => (
                <tr key={t.tax_code}>
                  <td>{name(t)}</td>
                  <td className="num">{num(value(t.tax_code, 3) ?? 0, 1)}</td>
                  <td className="num">{num(value(t.tax_code, 2) ?? 0, 2)}</td>
                  <td className="num">
                    {pct(((value(t.tax_code, 3) ?? 0) / total) * 100, 1)}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      }
      source={l(
        'OECD Revenue Statistics, general government, Sweden',
        'OECD Revenue Statistics, offentlig sektor, Sverige',
      )}
    >
      <RankBars
        label={l(
          `Tax revenue by tax, ${shown}`,
          `Skatteintäkter per skatt, ${shown}`,
        )}
        format={(v) => `${num(v, 0)} ${l('bn', 'mdkr')}`}
        limit={8}
        rows={[...all]
          .sort((a, b) => b.sek - a.sek)
          .map(({ t, sek }) => ({
            key: t.tax_code,
            label: name(t),
            value: sek,
            note: pct((sek / total) * 100, 0),
          }))}
      />
    </Feature>
  )
}
