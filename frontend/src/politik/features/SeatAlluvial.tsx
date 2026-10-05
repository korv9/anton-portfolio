/**
 * Every Riksdag since 1973 as an alluvial chart: one column per election, the parties stacked
 * largest on top, and a ribbon carrying each party's seats to the next election, so ribbons
 * cross when parties change places. It shows seats, not how voters moved between parties;
 * the data has no such flows. Hover or pick a party to follow it through every election.
 */
import { useEffect, useMemo, useState } from 'react'
import { l } from '../../i18n'
import { load, type Elections } from '../../parliament/data'
import { identity, partyFill, partyName } from '../../parties/identity'
import { Feature, Pick, useWidth } from '../../charts/feature/Feature'
import { num, pct } from '../controls'
import './features.css'

type Block = {
  party: string
  seats: number
  share: number
  y0: number
  y1: number
}
const FROM = ['1973', '1998', '2010'] as const
type From = (typeof FROM)[number]

export default function SeatAlluvial({ party }: { party?: string | null }) {
  const [data, setData] = useState<Elections | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [from, setFrom] = useState<From | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  useEffect(() => {
    load<Elections>('parliament/elections.json')
      .then(setData)
      .catch(() => setData(null))
  }, [])
  const narrow = width < 600
  const start = from ?? (narrow ? '2010' : '1973')
  const years = useMemo(
    () => (data?.years ?? []).filter((y) => y >= Number(start)),
    [data, start],
  )
  if (!data || years.length < 2) return <div ref={ref} />

  const H = narrow ? 340 : 400
  const pad = { l: 8, r: narrow ? 44 : 150, t: 22, b: 8 }
  const colW = narrow ? 12 : 16
  const gap = 2
  const seatsOf = (y: number) =>
    data.results
      .filter((r) => r.election_year === y && (r.seats ?? 0) > 0)
      .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))
  const most = Math.max(
    ...years.map((y) => seatsOf(y).reduce((s, r) => s + (r.seats ?? 0), 0)),
  )
  const maxParties = Math.max(...years.map((y) => seatsOf(y).length))
  const k = (H - pad.t - pad.b - gap * (maxParties - 1)) / most
  const columns = years.map((y, i) => {
    let at = pad.t
    const blocks: Block[] = seatsOf(y).map((r) => {
      const h = (r.seats ?? 0) * k
      const b = {
        party: r.party,
        seats: r.seats ?? 0,
        share: r.share_pct ?? 0,
        y0: at,
        y1: at + h,
      }
      at += h + gap
      return b
    })
    const x = pad.l + (i * (width - pad.l - pad.r - colW)) / (years.length - 1)
    return { year: y, x, blocks }
  })
  const ribbons = columns.slice(1).flatMap((c, i) => {
    const prev = columns[i]
    return c.blocks.flatMap((b) => {
      const a = prev.blocks.find((p) => p.party === b.party)
      if (!a) return []
      const x0 = prev.x + colW
      const x1 = c.x
      const m = (x0 + x1) / 2
      return [
        {
          key: `${b.party}-${c.year}`,
          party: b.party,
          d: `M${x0} ${a.y0} C${m} ${a.y0} ${m} ${b.y0} ${x1} ${b.y0} L${x1} ${b.y1} C${m} ${b.y1} ${m} ${a.y1} ${x0} ${a.y1} Z`,
        },
      ]
    })
  })
  const focus = hover ?? party ?? null
  const first = columns[0]
  const last = columns.at(-1)!
  const parties = [
    ...new Set(columns.flatMap((c) => c.blocks.map((b) => b.party))),
  ]
  const seatsAt = (p: string, c: (typeof columns)[number]) =>
    c.blocks.find((b) => b.party === p)?.seats ?? 0
  const gainer = [...parties].sort(
    (a, b) =>
      seatsAt(b, last) -
      seatsAt(b, first) -
      (seatsAt(a, last) - seatsAt(a, first)),
  )[0]
  const loser = [...parties].sort(
    (a, b) =>
      seatsAt(a, last) -
      seatsAt(a, first) -
      (seatsAt(b, last) - seatsAt(b, first)),
  )[0]
  const largestEvery = parties.find((p) =>
    columns.every((c) => c.blocks[0]?.party === p),
  )
  const name = (p: string) =>
    p === 'OTHER' ? l('Others', 'Övriga') : partyName(p)
  const code = (p: string) => (p === 'OTHER' ? '–' : p)
  const byParty = focus
    ? columns.map((c) => ({ year: c.year, seats: seatsAt(focus, c) }))
    : []

  return (
    <Feature
      id="mandat"
      title={l(
        `${largestEvery ? `${name(largestEvery)} has been largest in every election since ${first.year}. ` : ''}${name(gainer)} gained most seats (${seatsAt(gainer, first)} → ${seatsAt(gainer, last)}), ${name(loser)} lost most (${seatsAt(loser, first)} → ${seatsAt(loser, last)}).`,
        `${largestEvery ? `${name(largestEvery)} har varit störst i varje val sedan ${first.year}. ` : ''}${name(gainer)} har vunnit flest mandat (${seatsAt(gainer, first)} → ${seatsAt(gainer, last)}), ${name(loser)} tappat flest (${seatsAt(loser, first)} → ${seatsAt(loser, last)}).`,
      )}
      lead={l(
        'One column per election, the parties stacked by seats with the largest on top; each ribbon carries a party to the next election, and crosses another when they swap places. It shows seats, not how voters moved. Hover a party, or pick one above, to follow it.',
        'En kolumn per val, partierna staplade efter mandat med det största överst; varje band bär ett parti till nästa val och korsar ett annat när de byter plats. Det visar mandat, inte hur väljarna rörde sig. Håll över ett parti, eller välj ett ovan, för att följa det.',
      )}
      controls={
        <Pick
          label={l('From', 'Från')}
          value={start as From}
          options={FROM.map((f) => ({
            value: f,
            label: l(`From ${f}`, `Från ${f}`),
          }))}
          onChange={setFrom}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th>{l('Party', 'Parti')}</th>
              {columns.map((c) => (
                <th key={c.year} className="num">
                  {c.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => (
              <tr key={p}>
                <td>{name(p)}</td>
                {columns.map((c) => (
                  <td key={c.year} className="num">
                    {seatsAt(p, c) || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
      source={l(
        'SCB (1973–2022) and Valmyndigheten (2026), seats per party',
        'SCB (1973–2022) och Valmyndigheten (2026), mandat per parti',
      )}
    >
      <div className="alluvial" ref={ref}>
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={last.blocks
            .map((b) => `${name(b.party)} ${b.seats}`)
            .join(', ')}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
        >
          {ribbons.map((r) => (
            <path
              key={r.key}
              d={r.d}
              className={`alluvial-ribbon${focus ? (r.party === focus ? ' on' : ' off') : ''}`}
              style={{ fill: partyFill(r.party) }}
              onPointerEnter={() => setHover(r.party)}
              onPointerDown={() => setHover(r.party)}
            />
          ))}
          {columns.map((c) => (
            <g key={c.year}>
              <text
                className="alluvial-year"
                x={c.x + colW / 2}
                y={pad.t - 8}
                textAnchor="middle"
              >
                {narrow ? `’${String(c.year).slice(2)}` : c.year}
              </text>
              {c.blocks.map((b) => (
                <rect
                  key={b.party}
                  x={c.x}
                  y={b.y0}
                  width={colW}
                  height={Math.max(1, b.y1 - b.y0)}
                  className={`alluvial-block${focus ? (b.party === focus ? ' on' : ' off') : ''}`}
                  style={{ fill: partyFill(b.party) }}
                  onPointerEnter={() => setHover(b.party)}
                  onPointerDown={() => setHover(b.party)}
                >
                  <title>
                    {`${name(b.party)} ${c.year}: ${b.seats} ${l('seats', 'mandat')} (${pct(b.share, 1)})`}
                  </title>
                </rect>
              ))}
            </g>
          ))}
          {last.blocks.map((b) => (
            <text
              key={b.party}
              className={`alluvial-label${focus && focus !== b.party ? ' off' : ''}`}
              x={last.x + colW + 6}
              y={(b.y0 + b.y1) / 2}
              dy="0.32em"
              onPointerEnter={() => setHover(b.party)}
              onPointerDown={() => setHover(b.party)}
            >
              <tspan fontWeight={600}>
                {narrow ? code(b.party) : name(b.party)}
              </tspan>{' '}
              {b.seats}
            </text>
          ))}
        </svg>
        {focus && byParty.some((r) => r.seats) && (
          <p className="alluvial-readout" role="status">
            <span
              className="alluvial-swatch"
              style={{ background: partyFill(focus) }}
            />
            <b>
              {identity(focus).code === 'OTHER'
                ? name(focus)
                : partyName(focus)}
            </b>{' '}
            {byParty
              .map((r) => `${r.year}: ${r.seats ? num(r.seats) : '–'}`)
              .join(' · ')}
          </p>
        )}
      </div>
    </Feature>
  )
}
