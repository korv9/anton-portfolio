/**
 * Every Swedish tax as a bubble, its area the money it brings in, grouped in bands by kind of
 * tax. Pick a year to see the mix change (the wealth tax is there until 2007). Hover a bubble
 * for its amount, share of GDP and share of all taxes.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { fetchJson } from '../../welfare/data'
import { Feature, Pick, useTip, useWidth } from '../../charts/feature/Feature'
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
// Categorical slots 1–6 of the validated reference palette, in fixed order.
const COLOURS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
]

type Bubble = {
  code: string
  name: string
  sek: number
  gdp: number | null
  r: number
  x: number
  y: number
}

/** Circles packed into a band: each goes as high as it can, as near the middle as it can. */
function pack(items: Omit<Bubble, 'x' | 'y'>[], width: number) {
  const placed: Bubble[] = []
  for (const it of [...items].sort((a, b) => b.r - a.r)) {
    let best: { x: number; y: number } | null = null
    for (let y = it.r + 1; !best && y < 2000; y += 2) {
      for (let dx = 0; dx <= width / 2; dx += 2) {
        for (const x of [width / 2 - dx, width / 2 + dx]) {
          if (x - it.r < 0 || x + it.r > width) continue
          if (
            placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + it.r + 2)
          ) {
            best = { x, y }
            break
          }
        }
        if (best) break
      }
    }
    placed.push({ ...it, ...(best ?? { x: width / 2, y: it.r }) })
  }
  return placed
}

export default function TaxBubbles() {
  const [data, setData] = useState<Sweden | null>(null)
  const [year, setYear] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  const { box, show, hide, tip } = useTip()
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
  if (!data || !years.length) return <div ref={ref} />
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
  const maxSek = Math.max(...all.map((x) => x.sek))
  const narrow = width < 640
  const perRow = narrow ? 2 : groups.length
  const bandW = Math.floor((width - (perRow - 1) * 12) / perRow)
  const rMax = Math.min(narrow ? 58 : 70, bandW / 2 - 4)
  const radius = (sek: number) => Math.max(2.5, Math.sqrt(sek / maxSek) * rMax)
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
        `Every tax as a bubble, its area the money it brought in (${num(total, 0)} bn SEK in all), in bands by kind of tax. Pick a year to see the mix change${gone.length ? `; in ${shown} ${gone.map((t) => name(t).toLowerCase()).join(' and ')} brought in nothing` : ''}.`,
        `Varje skatt som en bubbla, ytan är pengarna den drog in (${num(total, 0)} mdkr totalt), i band efter sorts skatt. Välj ett år för att se hur mixen ändras${gone.length ? `; ${shown} drog ${gone.map((t) => name(t).toLowerCase()).join(' och ')} in noll` : ''}.`,
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
      <div
        className="taxbands"
        ref={(el) => {
          ref(el)
          box.current = el
        }}
        onMouseLeave={() => {
          setHover(null)
          hide()
        }}
      >
        {groups.map((g, gi) => {
          const colour = COLOURS[gi % COLOURS.length]
          const items = leaves(g.tax_code)
            .map((t) => ({ t, sek: value(t.tax_code, 3) ?? 0 }))
            .filter((x) => x.sek > 0)
          const bubbles = pack(
            items.map((x) => ({
              code: x.t.tax_code,
              name: name(x.t),
              sek: x.sek,
              gdp: value(x.t.tax_code, 2),
              r: radius(x.sek),
            })),
            bandW,
          )
          const h = Math.max(40, ...bubbles.map((b) => b.y + b.r + 2))
          const groupSek = value(g.tax_code, 3) ?? 0
          return (
            <section
              key={g.tax_code}
              className="taxband"
              style={{ ['--c' as string]: colour, width: bandW }}
            >
              <h3>{name(g)}</h3>
              <p>
                {num(groupSek, 0)} {l('bn', 'mdkr')} ·{' '}
                {pct((groupSek / total) * 100, 0)}
              </p>
              <svg
                width={bandW}
                height={h}
                role="img"
                aria-label={`${name(g)}: ${bubbles.map((b) => `${b.name} ${num(b.sek, 0)}`).join(', ')}`}
              >
                {bubbles.map((b) => (
                  <g
                    key={b.code}
                    className={`taxbubble${hover && hover !== b.code ? ' off' : ''}`}
                    onPointerMove={(e) => {
                      setHover(b.code)
                      show(
                        e,
                        <>
                          <b>{b.name}</b>
                          {num(b.sek, 1)} {l('bn SEK', 'mdkr')} ·{' '}
                          {pct((b.sek / total) * 100, 1)}{' '}
                          {l('of all taxes', 'av alla skatter')}
                          {b.gdp != null && (
                            <>
                              <br />
                              {pct(b.gdp, 1)} {l('of GDP', 'av BNP')}
                            </>
                          )}
                        </>,
                      )
                    }}
                    onPointerDown={(e) => {
                      setHover(b.code)
                      show(
                        e,
                        <>
                          <b>{b.name}</b>
                          {num(b.sek, 1)} {l('bn SEK', 'mdkr')} ·{' '}
                          {pct((b.sek / total) * 100, 1)}{' '}
                          {l('of all taxes', 'av alla skatter')}
                          {b.gdp != null && (
                            <>
                              <br />
                              {pct(b.gdp, 1)} {l('of GDP', 'av BNP')}
                            </>
                          )}
                        </>,
                      )
                    }}
                  >
                    <circle cx={b.x} cy={b.y} r={b.r} />
                    {b.r > 26 && (
                      <text x={b.x} y={b.y} textAnchor="middle">
                        <tspan x={b.x} dy="-0.2em">
                          {b.name.length > b.r / 3.4
                            ? `${b.name.slice(0, Math.floor(b.r / 3.4))}…`
                            : b.name}
                        </tspan>
                        <tspan x={b.x} dy="1.2em" className="taxbubble-num">
                          {num(b.sek, 0)}
                        </tspan>
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </section>
          )
        })}
        {tip}
      </div>
    </Feature>
  )
}
