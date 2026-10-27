/**
 * Mini dashboards for the hub's research labs, one result each from the lab's own files:
 * Philosophy (do passages group by book or by idea), Symbol (how many groups mix several books)
 * and Concept (where one concept ranks first, against chance). Each caption dates its run.
 */
import { l } from '../../i18n'
import { day, ok, useFile } from '../../tech/techData'
import { Loading, MiniBars } from './MiniChart'
import { Mini, pct } from './cardsPlatform'

type Run = { run: { ran_at?: string; run_at?: string } }
type Mixing = { clusters: number; cross_work_clusters: number }
type PhilosophyRun = {
  run: { ran_at?: string; evaluation?: Record<string, Mixing> }
}

const ranAt = (s: Run | 'error' | null) =>
  ok(s) ? (s.run.ran_at ?? s.run.run_at) : undefined

export function PhilosophyChart() {
  const summary = useFile<PhilosophyRun>('philosophy/summary.json')
  if (summary === null) return <Loading />
  if (!ok(summary)) return null
  // The pipeline's own measure (platform/nlp/philosophy/pipeline.py): a group mixes works when
  // it draws on at least three and none supplies more than half its passages.
  const plain = summary.run.evaluation?.baseline
  const centred = summary.run.evaluation?.author_centered
  if (!plain?.clusters || !centred?.clusters) return null
  const share = (m: Mixing) => m.cross_work_clusters / m.clusters
  const head = l(
    `Groups that mix works rise from ${plain.cross_work_clusters} of ${plain.clusters} on the plain map to ${centred.cross_work_clusters} of ${centred.clusters} with each work centred.`,
    `Grupper som blandar verk ökar från ${plain.cross_work_clusters} av ${plain.clusters} på den vanliga kartan till ${centred.cross_work_clusters} av ${centred.clusters} med varje verk centrerat.`,
  )
  const at = summary.run.ran_at
  return (
    <Mini
      head={head}
      caption={l(
        `Share of passage groups that mix at least three works with none supplying more than half, per map${at ? `, run ${day(at)} UTC` : ''}. philosophy/summary.json`,
        `Andel passagegrupper som blandar minst tre verk där inget står för mer än hälften, per karta${at ? `, körd ${day(at)} UTC` : ''}. philosophy/summary.json`,
      )}
    >
      <MiniBars
        bars={[
          {
            label: l('Plain map', 'Vanlig karta'),
            value: share(plain),
            note: l(
              `${plain.cross_work_clusters} of ${plain.clusters} groups`,
              `${plain.cross_work_clusters} av ${plain.clusters} grupper`,
            ),
          },
          {
            label: l('Each work centred', 'Varje verk centrerat'),
            value: share(centred),
            focal: true,
            note: l(
              `${centred.cross_work_clusters} of ${centred.clusters} groups`,
              `${centred.cross_work_clusters} av ${centred.clusters} grupper`,
            ),
          },
        ]}
        summary={head}
        format={(v) => pct(v, 0)}
        max={1}
      />
    </Mini>
  )
}

type Experiment = {
  experiment: string
  clusters: number
  cross_book_cluster_count: number
}

const EXPERIMENT: Record<string, [string, string]> = {
  baseline: ['Plain', 'Vanlig'],
  masked: ['Symbol word masked', 'Symbolordet maskerat'],
  book_centered: ['Each book centred', 'Varje bok centrerad'],
  masked_book_centered: ['Masked and centred', 'Maskerat och centrerat'],
}

export function SymbolChart() {
  const comparison = useFile<{ experiments: Experiment[] }>(
    'symbolic/experiment-comparison.json',
  )
  const summary = useFile<Run>('symbolic/summary.json')
  if (comparison === null) return <Loading />
  if (!ok(comparison)) return null
  // A mixed group draws on at least three books, none of them more than half its members
  // (platform/nlp/symbolic/evaluation.py).
  const rows = comparison.experiments.filter((r) => r.clusters > 0)
  if (!rows.length) return null
  const share = (r: Experiment) => r.cross_book_cluster_count / r.clusters
  const plain = rows.find((r) => r.experiment === 'baseline')
  const best = rows.reduce((a, b) => (share(b) > share(a) ? b : a))
  const name = (r: Experiment) =>
    l(...(EXPERIMENT[r.experiment] ?? [r.experiment, r.experiment]))
  const head = plain
    ? l(
        `Groups that mix books rise from ${pct(share(plain), 0)} on the plain map to ${pct(share(best), 0)} in the experiment “${EXPERIMENT[best.experiment]?.[0] ?? best.experiment}”.`,
        `Grupper som blandar böcker ökar från ${pct(share(plain), 0)} på den vanliga kartan till ${pct(share(best), 0)} i experimentet ”${EXPERIMENT[best.experiment]?.[1] ?? best.experiment}”.`,
      )
    : l('Mixed groups per experiment.', 'Blandade grupper per experiment.')
  const at = ranAt(summary)
  return (
    <Mini
      head={head}
      caption={l(
        `Share of symbol-word groups that mix at least three books with none supplying more than half, per clustering experiment${at ? `, run ${day(at)} UTC` : ''}. symbolic/experiment-comparison.json`,
        `Andel grupper av symbolord som blandar minst tre böcker där ingen står för mer än hälften, per klustringsexperiment${at ? `, körd ${day(at)} UTC` : ''}. symbolic/experiment-comparison.json`,
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: name(r),
          value: share(r),
          focal: r === best,
          note: l(
            `${r.cross_book_cluster_count} of ${r.clusters} groups`,
            `${r.cross_book_cluster_count} av ${r.clusters} grupper`,
          ),
        }))}
        summary={head}
        format={(v) => pct(v, 0)}
        max={1}
      />
    </Mini>
  )
}

type Profile = {
  concept_id: string
  corpus_id: string
  rank1_lift: number
  rank1_chunks: number
  chunks: number
}
type Corpora = Run & {
  corpora: { corpus_id: string; label_en: string; label_sv: string }[]
}

const CONCEPT = 'risk'

export function ConceptChart() {
  const profiles = useFile<Profile[]>('concepts/profiles.json')
  const summary = useFile<Corpora>('concepts/summary.json')
  if (profiles === null || summary === null) return <Loading />
  if (!ok(profiles) || !ok(summary)) return null
  const rows = summary.corpora.flatMap((corpus) => {
    const profile = profiles.find(
      (p) => p.concept_id === CONCEPT && p.corpus_id === corpus.corpus_id,
    )
    return profile ? [{ corpus, profile }] : []
  })
  if (!rows.length) return null
  const top = rows.reduce((a, b) =>
    b.profile.rank1_lift > a.profile.rank1_lift ? b : a,
  )
  const below = rows.filter((r) => r !== top && r.profile.rank1_lift < 1)
  const x = (v: number) => `${v.toFixed(2)}×`
  const head = l(
    `“Risk” ranks first for ${top.profile.rank1_chunks} of ${top.profile.chunks} passages in the ${top.corpus.label_en}, ${x(top.profile.rank1_lift)} chance${below.length === rows.length - 1 ? '; below chance in the other corpora' : ''}.`,
    `”Risk” rankas först för ${top.profile.rank1_chunks} av ${top.profile.chunks} passager i ${top.corpus.label_sv}, ${x(top.profile.rank1_lift)} slumpen${below.length === rows.length - 1 ? '; under slumpen i de andra korpusarna' : ''}.`,
  )
  const at = ranAt(summary)
  return (
    <Mini
      head={head}
      caption={l(
        `How often “risk” ranks first among 28 concepts for a passage, against chance (dashed line at 1×), per corpus${at ? `, run ${day(at)} UTC` : ''}. concepts/profiles.json`,
        `Hur ofta ”risk” rankas först av 28 begrepp för en passage, mot slumpen (streckad linje vid 1×), per korpus${at ? `, körd ${day(at)} UTC` : ''}. concepts/profiles.json`,
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: l(r.corpus.label_en, r.corpus.label_sv),
          value: r.profile.rank1_lift,
          focal: r === top,
          note: l(
            `first in ${r.profile.rank1_chunks} of ${r.profile.chunks} passages`,
            `först i ${r.profile.rank1_chunks} av ${r.profile.chunks} passager`,
          ),
        }))}
        summary={head}
        format={x}
        reference={{
          value: 1,
          label: l('Dashed line: chance (1×)', 'Streckad linje: slumpen (1×)'),
        }}
      />
    </Mini>
  )
}
