/**
 * The hub's pictures for Cluster Visuals and the other projects, each from a committed file or the
 * project page's own figures: the debate-subject map, the degree project's 121 clusters, the drug
 * model's correlation per test split and the Homie API's 16 operations.
 */
import { PointCanvas } from '../../home/JobsMap'
import type { Xyc } from '../../clusters/clusterGeometry'
import { l } from '../../i18n'
import { GROUPS } from '../../products/HomieFlow'
import { FACTS } from '../../products/ThesisCase'
import { num, ok, useFile } from '../../tech/techData'
import { Loading, MiniBars, MiniLine } from './MiniChart'
import {
  partialYears,
  topicId,
  yearly,
  type DebateTopics,
} from '../../replik/compute'
import { Mini, pct } from './cardsPlatform'

type Topics = {
  observations: number
  clusters: number
  noise_share: number
  points: [id: string, x: number, y: number, cluster: number, label: string][]
}

export function ClusterChart() {
  const topics = useFile<Topics>('cluster-research/debate-topics.json')
  if (topics === null) return <Loading />
  if (!ok(topics) || !topics.points.length) return null
  const points: Xyc[] = topics.points.map(([, x, y, c]) => [x, y, c])
  return (
    <Mini
      head={l(
        `${num(topics.observations)} passages from Riksdag party-leader debates sort into ${topics.clusters} subjects; ${pct(topics.noise_share, 0)} belong to none.`,
        `${num(topics.observations)} passager ur riksdagens partiledardebatter sorteras i ${topics.clusters} ämnen; ${pct(topics.noise_share, 0)} hör till inget.`,
      )}
      caption={l(
        `Each dot is one of ${num(points.length)} sampled passages on the UMAP map; warm tones are subjects, the faintest belong to none. cluster-research/debate-topics.json`,
        `Varje punkt är en av ${num(points.length)} utvalda passager på UMAP-kartan; varma toner är ämnen, de svagaste hör till inget. cluster-research/debate-topics.json`,
      )}
    >
      <div className="hub-point-map">
        <PointCanvas points={points} />
      </div>
    </Mini>
  )
}

export function ThesisChart() {
  const { clusters, unlinked, selectedRun } = FACTS
  const head = l(
    `${unlinked} of the ${clusters} incident clusters have no ticket linked to a registered problem.`,
    `${unlinked} av de ${clusters} incidentklustren saknar ärende kopplat till ett registrerat problem.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        `Each dot is a cluster of similar tickets from the selected run of ${num(selectedRun)}; bright: no problem link. Order is arbitrary. From the degree project.`,
        `Varje prick är ett kluster av liknande ärenden ur den valda körningen på ${num(selectedRun)}; ljus: ingen problemkoppling. Ordningen är godtycklig. Ur examensarbetet.`,
      )}
    >
      <div className="thesis-grid" role="img" aria-label={head}>
        {Array.from({ length: clusters }, (_, i) => (
          <span
            key={i}
            className={`thesis-dot${i < unlinked ? ' is-open' : ''}`}
          />
        ))}
      </div>
    </Mini>
  )
}

type Report = {
  metrics: {
    scheme: string
    model: string
    pearson: number | null
    pearson_sd: number | null
  }[]
}

// The report's test splits, the unseen drug pair first (DrugCombReport.tsx keeps the same order).
const SPLITS: [string, string, string][] = [
  ['cold_pair', 'New drug pair', 'Nytt läkemedelspar'],
  ['cold_drug', 'New drug', 'Nytt läkemedel'],
  ['cold_cell', 'New cell line', 'Ny cellinje'],
  ['random', 'Random rows', 'Slumpade rader'],
]

export function DrugChart() {
  const report = useFile<Report>('products/drugcomb/report.json')
  if (report === null) return <Loading />
  if (!ok(report)) return null
  const bars = SPLITS.flatMap(([scheme, en, sv]) => {
    const m = report.metrics.find(
      (r) => r.scheme === scheme && r.model === 'lgbm_all',
    )
    return m?.pearson != null
      ? [
          {
            label: l(en, sv),
            value: m.pearson,
            focal: scheme === 'cold_pair',
            note: `± ${(m.pearson_sd ?? 0).toFixed(3)}`,
          },
        ]
      : []
  })
  if (!bars.length) return null
  const pair = bars.find((b) => b.focal)
  const head = pair
    ? l(
        `On a drug pair it has never seen, the model’s predicted synergy correlates ${pair.value.toFixed(2)} with the measured one.`,
        `På ett läkemedelspar den aldrig sett korrelerar modellens förutsagda synergi ${pair.value.toFixed(2)} med den uppmätta.`,
      )
    : l('Correlation per test split.', 'Korrelation per testuppdelning.')
  return (
    <Mini
      head={head}
      caption={l(
        'Pearson correlation between predicted and measured ZIP synergy for the LightGBM model, mean of three folds, per held-out split. products/drugcomb/report.json',
        'Pearson-korrelation mellan förutsagd och uppmätt ZIP-synergi för LightGBM-modellen, medel av tre omgångar, per undanhållen uppdelning. products/drugcomb/report.json',
      )}
    >
      <MiniBars
        bars={bars}
        summary={head}
        format={(v) => v.toFixed(2)}
        max={1}
      />
    </Mini>
  )
}

export function HomieChart() {
  const total = GROUPS.reduce((n, g) => n + g.n, 0)
  const built = GROUPS.filter((g) => g.built).reduce((n, g) => n + g.n, 0)
  const head = l(
    `${built} of the ${total} operations in the API contract are built and tested in CI.`,
    `${built} av de ${total} operationerna i API-kontraktet är byggda och testade i CI.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        'One dot per operation in openapi.json, by tag; filled: built and covered by CI, open: returns a contract-exact preview.',
        'En prick per operation i openapi.json, per tagg; fylld: byggd och täckt av CI, öppen: returnerar en kontraktsexakt förhandsvisning.',
      )}
    >
      <div className="hub-ops" role="img" aria-label={head}>
        {GROUPS.map((g) => (
          <span key={g.en}>
            <span className="hub-ops-dots">
              {Array.from({ length: g.n }, (_, i) => (
                <span key={i} data-built={g.built || undefined} />
              ))}
            </span>
            <span className="hub-ops-name">{l(g.en, g.sv)}</span>
          </span>
        ))}
      </div>
    </Mini>
  )
}

/** Replik: how much of the party-leader debates went to nuclear power and electricity, by year. */
export function ReplikChart() {
  const topics = useFile<DebateTopics>('clusters/debate-topics.json')
  if (topics === null) return <Loading />
  if (!ok(topics)) return null
  const id = topicId(topics, 'Nuclear power and electricity')
  const partial = partialYears(yearly(topics, id))
  const series = yearly(topics, id).filter((s) => !partial.has(s.period))
  if (series.length < 3) return null
  const top = series.reduce((a, b) => (b.value > a.value ? b : a))
  const points = series.map((s) => ({
    x: Number(s.period),
    y: s.value,
    label: `${s.period}: ${pct(s.value, 1)}`,
  }))
  const first = points[0]
  const last = points.at(-1)!
  return (
    <Mini
      head={l(
        `Nuclear power and electricity took ${pct(top.value, 1)} of the party leaders' debate passages in ${top.period}.`,
        `Kärnkraft och el tog ${pct(top.value, 1)} av partiledarnas debattinlägg ${top.period}.`,
      )}
      caption={l(
        `Share of party-leader debate passages on the topic per year, ${first.x}–${last.x}. clusters/debate-topics.json`,
        `Ämnets andel av inläggen i partiledardebatterna per år, ${first.x}–${last.x}. clusters/debate-topics.json`,
      )}
    >
      <MiniLine
        series={[{ id: 'energy', name: 'energy', points }]}
        summary={l(
          `Share of debate passages on nuclear power and electricity, ${first.x} to ${last.x}; highest ${pct(top.value, 1)} in ${top.period}.`,
          `Andel debattinlägg om kärnkraft och el, ${first.x} till ${last.x}; högst ${pct(top.value, 1)} ${top.period}.`,
        )}
        format={(y) => pct(y, 1)}
        ticks={[
          { x: first.x, label: String(first.x) },
          { x: last.x, label: String(last.x) },
        ]}
        mark={{
          index: points.findIndex((p) => p.x === Number(top.period)),
          label: top.period,
        }}
      />
    </Mini>
  )
}
