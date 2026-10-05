/**
 * The job market as a treemap: every occupation field a rectangle as large as its job ads so
 * far this year, coloured by how much that changed from the same months last year. Click a
 * field to open its occupations; the path above takes you back. The field bar above the page
 * opens a field directly.
 */
import { useState } from 'react'
import { l } from '../i18n'
import { Feature, useTip, useWidth } from '../charts/feature/Feature'
import { type Market, change, fieldName, number, signedPct } from './data'

type Tile = {
  id: string
  name: string
  now: number
  before: number
  x: number
  y: number
  w: number
  h: number
}

/** Squarified treemap (Bruls, Huizing & van Wijk 2000): rows of tiles as close to square as
 * the sizes allow. */
function squarify<T extends { now: number }>(
  items: T[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const total = items.reduce((s, i) => s + i.now, 0)
  const scale = (w * h) / (total || 1)
  const out: (T & { x: number; y: number; w: number; h: number })[] = []
  let rest = [...items].sort((a, b) => b.now - a.now)
  let box = { x, y, w, h }
  const worst = (row: T[], side: number) => {
    const areas = row.map((r) => r.now * scale)
    const sum = areas.reduce((s, a) => s + a, 0)
    return Math.max(
      ...areas.map((a) =>
        Math.max(
          (side * side * a) / (sum * sum),
          (sum * sum) / (side * side * a),
        ),
      ),
    )
  }
  while (rest.length) {
    const side = Math.min(box.w, box.h)
    const row: T[] = [rest[0]]
    let i = 1
    while (
      i < rest.length &&
      worst([...row, rest[i]], side) <= worst(row, side)
    ) {
      row.push(rest[i])
      i++
    }
    rest = rest.slice(i)
    const sum = row.reduce((s, r) => s + r.now * scale, 0)
    const thick = sum / side
    let at = 0
    for (const r of row) {
      const len = (r.now * scale) / thick
      if (box.w >= box.h)
        out.push({ ...r, x: box.x, y: box.y + at, w: thick, h: len })
      else out.push({ ...r, x: box.x + at, y: box.y, w: len, h: thick })
      at += len
    }
    box =
      box.w >= box.h
        ? { x: box.x + thick, y: box.y, w: box.w - thick, h: box.h }
        : { x: box.x, y: box.y + thick, w: box.w, h: box.h - thick }
  }
  return out
}

// Diverging: red where ads fell, blue where they rose, grey in between.
const BINS: { max: number; fill: string; ink: string }[] = [
  { max: -20, fill: '#c8413b', ink: '#fff' },
  { max: -5, fill: '#eab0a8', ink: '#111' },
  { max: 5, fill: '#e3e3de', ink: '#111' },
  { max: 20, fill: '#9ec5f4', ink: '#111' },
  { max: Infinity, fill: '#1c5cab', ink: '#fff' },
]
const bin = (v: number | null) => BINS.find((b) => (v ?? 0) <= b.max)!

export default function Treemap({
  data,
  fields,
}: {
  data: Market
  fields: string[]
}) {
  const [openField, setOpenField] = useState<string | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  const { box, show, hide, tip } = useTip()
  const year = data.latest_year
  const field = openField ?? (fields.length === 1 ? fields[0] : null)
  const nameOf = (id: string) =>
    fieldName(data.fields.find((f) => f.id === id)?.name ?? id)
  const items = field
    ? data.occupations
        .filter((o) => o.field === field)
        .map((o) => ({
          id: o.id,
          name: o.name,
          now: o.ytd[year] ?? 0,
          before: o.ytd[year - 1] ?? 0,
        }))
    : data.fields.map((f) => {
        const occ = data.occupations.filter((o) => o.field === f.id)
        return {
          id: f.id,
          name: fieldName(f.name),
          now: occ.reduce((s, o) => s + (o.ytd[year] ?? 0), 0),
          before: occ.reduce((s, o) => s + (o.ytd[year - 1] ?? 0), 0),
        }
      })
  const shown = items.filter((i) => i.now > 0)
  const H = width < 600 ? 420 : 460
  const tiles: Tile[] = squarify(shown, 0, 0, width, H)
  const total = shown.reduce((s, i) => s + i.now, 0)
  const before = shown.reduce((s, i) => s + i.before, 0)
  const growing = shown.filter((i) => (change(i.now, i.before) ?? 0) > 0)
  const biggest = [...shown].sort((a, b) => b.now - a.now)[0]
  const months = data.ytd_months

  return (
    <Feature
      id="treemap"
      title={l(
        `${biggest?.name}: most ads so far in ${year}. ${growing.length} of ${shown.length} ${field ? 'occupations' : 'fields'} grew on last year.`,
        `${biggest?.name}: flest annonser hittills ${year}. ${growing.length} av ${shown.length} ${field ? 'yrken' : 'yrkesområden'} ökade mot i fjol.`,
      )}
      lead={l(
        `Area: job ads in the first ${months} months of ${year} (${number(total)}, ${signedPct(change(total, before))} on the same months of ${year - 1}). Colour: the change. ${field ? 'The path above goes back to all fields.' : 'Click a field to open its occupations.'}`,
        `Yta: jobbannonser de första ${months} månaderna ${year} (${number(total)}, ${signedPct(change(total, before))} mot samma månader ${year - 1}). Färg: förändringen. ${field ? 'Stigen ovanför går tillbaka till alla områden.' : 'Klicka på ett område för att öppna dess yrken.'}`,
      )}
      controls={
        <nav className="treemap-path" aria-label={l('Level', 'Nivå')}>
          <button
            type="button"
            onClick={() => setOpenField(null)}
            aria-current={!field}
          >
            {l('All fields', 'Alla områden')}
          </button>
          {field && (
            <>
              <span aria-hidden="true">›</span>
              <b>{nameOf(field)}</b>
            </>
          )}
        </nav>
      }
      table={
        <table>
          <thead>
            <tr>
              <th>
                {field ? l('Occupation', 'Yrke') : l('Field', 'Yrkesområde')}
              </th>
              <th className="num">{year}</th>
              <th className="num">{year - 1}</th>
              <th className="num">{l('Change', 'Förändring')}</th>
            </tr>
          </thead>
          <tbody>
            {[...shown]
              .sort((a, b) => b.now - a.now)
              .map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td className="num">{number(i.now)}</td>
                  <td className="num">{number(i.before)}</td>
                  <td className="num">{signedPct(change(i.now, i.before))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      }
      source={l(
        'Arbetsförmedlingen, JobTech historical job ads',
        'Arbetsförmedlingen, JobTechs historiska jobbannonser',
      )}
    >
      <ul className="feature-legend treemap-legend">
        {[
          l('fell over 20 %', 'minskade över 20 %'),
          l('fell 5–20 %', 'minskade 5–20 %'),
          l('about the same', 'ungefär lika'),
          l('rose 5–20 %', 'ökade 5–20 %'),
          l('rose over 20 %', 'ökade över 20 %'),
        ].map((t, i) => (
          <li key={t} style={{ ['--c' as string]: BINS[i].fill }}>
            {t}
          </li>
        ))}
      </ul>
      <div
        className="treemap"
        ref={(el) => {
          ref(el)
          box.current = el
        }}
        style={{ height: H }}
        onMouseLeave={hide}
      >
        {tiles.map((t, i) => {
          const c = change(t.now, t.before)
          const b = bin(c)
          const big = t.w > 84 && t.h > 46
          const Tag = field ? 'div' : 'button'
          return (
            <Tag
              key={t.id}
              className="treemap-tile"
              {...(field
                ? {}
                : {
                    type: 'button' as const,
                    onClick: () => setOpenField(t.id),
                  })}
              aria-label={`${t.name}: ${number(t.now)}, ${signedPct(c)}`}
              style={{
                left: t.x,
                top: t.y,
                width: Math.max(0, t.w - 2),
                height: Math.max(0, t.h - 2),
                background: b.fill,
                color: b.ink,
                ['--i' as string]: i,
              }}
              onPointerMove={(e) =>
                show(
                  e,
                  <>
                    <b>{t.name}</b>
                    {number(t.now)} {l('ads', 'annonser')} · {signedPct(c)}{' '}
                    {l(`on ${year - 1}`, `mot ${year - 1}`)}
                  </>,
                )
              }
              onPointerDown={(e) =>
                show(
                  e,
                  <>
                    <b>{t.name}</b>
                    {number(t.now)} {l('ads', 'annonser')} · {signedPct(c)}{' '}
                    {l(`on ${year - 1}`, `mot ${year - 1}`)}
                  </>,
                )
              }
            >
              {big && (
                <>
                  <span className="treemap-name">{t.name}</span>
                  <span className="treemap-num">
                    {number(t.now)} · {signedPct(c)}
                  </span>
                </>
              )}
            </Tag>
          )
        })}
        {tip}
      </div>
    </Feature>
  )
}
