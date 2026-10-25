/**
 * Mini dashboards for the hub's research labs, one result each from the lab's own files:
 * Philosophy (do passages group by book or by idea), Symbol (how many groups span several
 * books) and Concept (where one concept is the closest, against chance).
 */
import { l } from '../../i18n'
import { ok, useFile } from '../../tech/techData'
import { MiniBars } from './MiniChart'
import { Mini, pct } from './cardsPlatform'

type Cluster = { variant: string; largest_work_share: number }

export function PhilosophyChart() {
  const clusters = useFile<Cluster[]>('philosophy/clusters.json')
  if (!ok(clusters) || !clusters.length) return null
  const variants = [...new Set(clusters.map((c) => c.variant))]
  const rows = variants.map((variant) => {
    const these = clusters.filter((c) => c.variant === variant)
    const mostly = these.filter((c) => c.largest_work_share > 0.5).length
    return { variant, groups: these.length, mostly }
  })
  const name = (v: string) =>
    v === 'baseline'
      ? l('Plain map', 'Vanlig karta')
      : v === 'author_centered'
        ? l('Each work centred', 'Varje verk centrerat')
        : v
  const plain = rows.find((r) => r.variant === 'baseline')
  const centred = rows.find((r) => r.variant === 'author_centered')
  const head =
    plain && centred
      ? l(
          `On the plain map ${plain.mostly} of ${plain.groups} groups are mostly one book; with each work centred, ${centred.mostly} of ${centred.groups}.`,
          `På den vanliga kartan består ${plain.mostly} av ${plain.groups} grupper mest av en bok; med varje verk centrerat ${centred.mostly} av ${centred.groups}.`,
        )
      : l(
          'How many groups are mostly one book.',
          'Hur många grupper som mest består av en bok.',
        )
  return (
    <Mini
      head={head}
      caption={l(
        'Share of passage groups where one work supplies more than half the passages, per map. philosophy/clusters.json',
        'Andel passagegrupper där ett verk står för mer än hälften av passagerna, per karta. philosophy/clusters.json',
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: name(r.variant),
          value: r.mostly / r.groups,
          focal: r.variant === 'baseline',
          note: l(
            `${r.mostly} of ${r.groups} groups`,
            `${r.mostly} av ${r.groups} grupper`,
          ),
        }))}
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
  if (!ok(comparison) || !comparison.experiments.length) return null
  const rows = comparison.experiments
  const share = (r: Experiment) => r.cross_book_cluster_count / r.clusters
  const plain = rows.find((r) => r.experiment === 'baseline')
  const centred = rows.find((r) => r.experiment === 'book_centered')
  const head =
    plain && centred
      ? l(
          `Centring each book raises the groups that span several books from ${pct(share(plain), 0)} to ${pct(share(centred), 0)}.`,
          `Att centrera varje bok höjer andelen grupper som spänner över flera böcker från ${pct(share(plain), 0)} till ${pct(share(centred), 0)}.`,
        )
      : l(
          'Groups that span several books.',
          'Grupper som spänner över flera böcker.',
        )
  return (
    <Mini
      head={head}
      caption={l(
        'Share of symbol-word groups drawn from more than one book, per clustering experiment. symbolic/experiment-comparison.json',
        'Andel grupper av symbolord från fler än en bok, per klustringsexperiment. symbolic/experiment-comparison.json',
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: l(
            ...(EXPERIMENT[r.experiment] ?? [r.experiment, r.experiment]),
          ),
          value: share(r),
          focal: r.experiment === 'book_centered',
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
type Corpora = {
  corpora: { corpus_id: string; label_en: string; label_sv: string }[]
}

const CONCEPT = 'risk'

export function ConceptChart() {
  const profiles = useFile<Profile[]>('concepts/profiles.json')
  const summary = useFile<Corpora>('concepts/summary.json')
  if (!ok(profiles) || !ok(summary)) return null
  const rows = summary.corpora
    .map((c) => ({
      corpus: c,
      profile: profiles.find(
        (p) => p.concept_id === CONCEPT && p.corpus_id === c.corpus_id,
      ),
    }))
    .filter((r) => r.profile)
  if (!rows.length) return null
  const top = rows.reduce((a, b) =>
    b.profile!.rank1_lift > a.profile!.rank1_lift ? b : a,
  )
  const x = (v: number) => `${v.toFixed(2)}×`
  const head = l(
    `“Risk” is the closest concept to a passage most often in ${top.corpus.label_en}: ${x(top.profile!.rank1_lift)} as often as chance.`,
    `”Risk” är oftast det närmaste begreppet i ${top.corpus.label_sv}: ${x(top.profile!.rank1_lift)} så ofta som slumpen.`,
  )
  return (
    <Mini
      head={head}
      caption={l(
        'How often “risk” ranks first among 28 concepts for a passage, against chance (dashed line at 1×), per corpus. concepts/profiles.json',
        'Hur ofta ”risk” rankas först av 28 begrepp för en passage, mot slumpen (streckad linje vid 1×), per korpus. concepts/profiles.json',
      )}
    >
      <MiniBars
        bars={rows.map((r) => ({
          label: l(r.corpus.label_en, r.corpus.label_sv),
          value: r.profile!.rank1_lift,
          focal: r === top,
          note: l(
            `first in ${r.profile!.rank1_chunks} of ${r.profile!.chunks} passages`,
            `först i ${r.profile!.rank1_chunks} av ${r.profile!.chunks} passager`,
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
