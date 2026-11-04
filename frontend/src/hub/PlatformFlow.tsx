/**
 * The platform's flow from docs/case-studies/platform.md › Architecture, drawn top to bottom so
 * one layout reads at 390 pixels and on a desktop. Arrows first, boxes over them; the gate
 * (tests and contracts) is the one focal node. R2 feeds the browser directly, as in the source.
 */
import { l } from '../i18n'

type Box = {
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  focal?: boolean
}

export default function PlatformFlow({ titleId }: { titleId: string }) {
  const boxes: Box[] = [
    { x: 20, y: 0, w: 300, h: 44, label: l('Public sources', 'Öppna källor') },
    {
      x: 20,
      y: 72,
      w: 300,
      h: 56,
      label: l('Python ingestion', 'Python-inläsning'),
      sub: l('raw files + provenance', 'råfiler + härkomst'),
    },
    { x: 20, y: 156, w: 300, h: 44, label: 'dbt bronze' },
    { x: 20, y: 228, w: 300, h: 44, label: 'dbt silver' },
    { x: 20, y: 300, w: 300, h: 44, label: 'dbt gold' },
    {
      x: 20,
      y: 372,
      w: 300,
      h: 44,
      label: l(
        'Tests, contracts, schemas, validators',
        'Tester, kontrakt, scheman, validatorer',
      ),
      focal: true,
    },
    {
      x: 20,
      y: 444,
      w: 140,
      h: 56,
      label: 'JSON',
      sub: l('committed to Git', 'incheckad i Git'),
    },
    { x: 180, y: 444, w: 140, h: 56, label: 'Cloudflare R2' },
    {
      x: 20,
      y: 528,
      w: 210,
      h: 56,
      label: 'Cloudflare Worker',
      sub: '+ Workers AI',
    },
    { x: 20, y: 612, w: 300, h: 44, label: l('The site', 'Sajten') },
  ]
  // Vertical arrows: x, from y, to y (each ends at the next box's top edge).
  const arrows: [number, number, number][] = [
    [170, 44, 72],
    [170, 128, 156],
    [170, 200, 228],
    [170, 272, 300],
    [170, 344, 372],
    [90, 416, 444],
    [250, 416, 444],
    [90, 500, 528],
    [125, 584, 612],
    [250, 500, 612],
  ]
  const descId = `${titleId}-desc`
  return (
    <svg
      className="hub-flow"
      viewBox="0 0 340 660"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <desc id={descId}>
        {l(
          'Public sources go to Python ingestion, which keeps raw files with their provenance, then through dbt bronze, silver and gold, then through tests, contracts, schemas and validators. From there JSON committed to Git goes to the Cloudflare Worker with Workers AI, which serves the site; Cloudflare R2 feeds the site directly.',
          'Öppna källor går till Python-inläsningen, som sparar råfiler med härkomst, sedan genom dbt bronze, silver och gold, sedan genom tester, kontrakt, scheman och validatorer. Därifrån går JSON incheckad i Git till Cloudflare Worker med Workers AI, som serverar sajten; Cloudflare R2 matar sajten direkt.',
        )}
      </desc>
      <defs>
        <marker
          id={`${titleId}-arrow`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" className="hub-flow-head" />
        </marker>
      </defs>
      {arrows.map(([x, y1, y2]) => (
        <line
          key={`${x}-${y1}`}
          x1={x}
          y1={y1}
          x2={x}
          y2={y2 - 1}
          className="hub-flow-arrow"
          markerEnd={`url(#${titleId}-arrow)`}
        />
      ))}
      {boxes.map((b) => (
        <g key={b.label} className={b.focal ? 'hub-flow-focal' : undefined}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" />
          <text
            x={b.x + b.w / 2}
            y={b.y + (b.sub ? 23 : b.h / 2 + 5)}
            textAnchor="middle"
          >
            {b.label}
          </text>
          {b.sub && (
            <text
              x={b.x + b.w / 2}
              y={b.y + 43}
              textAnchor="middle"
              className="hub-flow-sub"
            >
              {b.sub}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
