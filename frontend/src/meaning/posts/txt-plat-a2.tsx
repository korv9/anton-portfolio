/** The platform itself: data quality checks and the size of the gold tables. */
import { Frame, useData, type Post } from '../kit'
import { Bars, Kpi, fmt, heading, usable } from './txt-kit'
import { l } from '../../i18n'

type Check = {
  quality_check_id: string
  product_id: string
  dimension: string
  status: string
}
type Semantic = { tables: Record<string, { rows: number }> }
const CHECKS = 'quality/checks.json'
const GOLD = 'gold/semantic-model.json'
const d = 'platform'

const STATUS: Record<string, readonly [string, string]> = {
  not_measured: ['not measured', 'inte mätt'],
  not_applicable: ['not applicable', 'ej tillämplig'],
  warning: ['warning', 'varning'],
  fail: ['failed', 'underkänd'],
}
/** The quality dimensions in Swedish, as ISO 25012 names them. */
const DIMENSION_SV: Record<string, string> = {
  accuracy: 'korrekthet',
  completeness: 'fullständighet',
  consistency: 'konsistens',
  credibility: 'trovärdighet',
  currentness: 'aktualitet',
  traceability: 'spårbarhet',
}
/** Passing, applicable (all but not_applicable) and the rest, from the statuses in the file. */
function tally(rows: Check[]) {
  const n = (s: string) => rows.filter((c) => c.status === s).length
  return {
    pass: n('pass'),
    applicable: rows.length - n('not_applicable'),
    unmeasured: n('not_measured'),
    failed: n('fail'),
  }
}

/** The pass count over applicable checks, then every check that did not pass, by name. */
function QualityMatrix() {
  const data = usable(useData<Check[]>(CHECKS), CHECKS, (r) => r.length)
  return (
    <Frame data={data}>
      {(rows) => {
        const t = tally(rows)
        const rest = rows
          .filter((c) => c.status !== 'pass')
          .sort((a, b) => a.status.localeCompare(b.status))
        return (
          <>
            <Kpi
              value={`${t.pass} / ${t.applicable}`}
              unit={l(
                'applicable checks pass',
                'tillämpliga kontroller godkända',
              )}
            />
            <ul
              className="mean-txt-list"
              aria-label={l(
                'Checks that did not pass',
                'Kontroller som inte blev godkända',
              )}
            >
              {rest.map((c) => (
                <li key={c.quality_check_id}>
                  <span>{`${c.product_id.replace(/_/g, ' ')}, ${l(c.dimension, DIMENSION_SV[c.dimension] ?? c.dimension)}`}</span>
                  <b>
                    {STATUS[c.status]
                      ? l(...STATUS[c.status])
                      : c.status.replace(/_/g, ' ')}
                  </b>
                </li>
              ))}
            </ul>
          </>
        )
      }}
    </Frame>
  )
}

/** 'fact_law_provision' → 'law provision'. */
const tableName = (t: string) =>
  t.replace(/^(fact|dim|mart)_/, '').replace(/_/g, ' ')
const bySize = ({ tables }: Semantic) =>
  Object.entries(tables)
    .filter(([, t]) => t.rows > 0)
    .sort((a, b) => b[1].rows - a[1].rows)

function GoldRows() {
  const data = usable(useData<Semantic>(GOLD), GOLD, (g) => bySize(g).length)
  return (
    <Frame data={data}>
      {(g) => (
        <Bars
          label={l(
            'Rows per gold table, largest first',
            'Rader per guldtabell, störst först',
          )}
          format={fmt}
          long
          rows={bySize(g).map(([name, t]) => ({
            key: name,
            label: tableName(name),
            value: t.rows,
          }))}
        />
      )}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-plat-quality-matrix',
    domain: d,
    sources: ['quality/checks.json'],
    title: heading((rows: Check[]) => {
      if (!rows.length) return ''
      const t = tally(rows)
      const parts = [
        l(
          `${t.pass} of ${t.applicable} applicable data quality checks pass`,
          `${t.pass} av ${t.applicable} tillämpliga datakvalitetskontroller är godkända`,
        ),
        t.failed ? l(`${t.failed} fail`, `${t.failed} underkända`) : '',
        t.unmeasured
          ? l(
              `${t.unmeasured} not measured`,
              `${t.unmeasured} ${t.unmeasured === 1 ? 'inte mätt' : 'inte mätta'}`,
            )
          : '',
      ]
      return parts.filter(Boolean).join('; ')
    }),
    note: [
      'Checks across the data products; the list names each one that did not pass',
      'Kontroller över dataprodukterna; listan namnger varje kontroll som inte blev godkänd',
    ],
    render: () => <QualityMatrix />,
  },
  {
    id: 'txt-plat-gold-rows',
    domain: d,
    sources: ['gold/semantic-model.json'],
    title: heading((g: Semantic) => {
      const rows = bySize(g)
      return l(
        `“${tableName(rows[0][0])}” is the largest of ${rows.length} gold tables, with ${fmt(rows[0][1].rows)} rows`,
        `”${tableName(rows[0][0])}” är störst av ${rows.length} guldtabeller, med ${fmt(rows[0][1].rows)} rader`,
      )
    }),
    note: [
      'Rows per table in the gold layer; fact, dim and mart prefixes left out of the names',
      'Rader per tabell i guldlagret; prefixen fact, dim och mart är borttagna ur namnen',
    ],
    render: () => <GoldRows />,
  },
]
