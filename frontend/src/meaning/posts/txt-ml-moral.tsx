/** Moral labels: a model on the ETHICS benchmark and a moral-foundations tagger beside people. */
import { focal, Frame, OTHER, useData, type Post } from '../kit'
import { XAxis } from '../axes'
import { linearScale } from '../../charts/scales'
import { Svg } from './txt-kit'
import { l } from '../../i18n'
import { fixed } from '../../format'

type Subset = {
  subset: string
  wording: number
  accuracy: number
  accuracy_ci_low: number
  accuracy_ci_high: number
  majority_accuracy: number
}
type Ethics = { subsets: Subset[] }
type Foundation = {
  foundation: string
  tagger_vs_annotator_f1: number
  human_pair_f1: number
  /** 95 % interval of tagger-vs-annotator minus annotator-vs-annotator F1. */
  ceiling_gap_low: number
  ceiling_gap_high: number
}
type Foundations = { english: Foundation[] }

const ETHICS = 'philosophy/moral/ethics.json'
const FOUNDATIONS = 'philosophy/moral/foundations.json'

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const pc = (v: number) => `${Math.round(v * 100)} %`
const f1 = (v: number) => fixed(v, 2)
/** Swedish names for the ETHICS subsets and the moral foundations; the files' are English. */
const SV: Record<string, string> = {
  commonsense: 'sunt förnuft',
  deontology: 'deontologi',
  justice: 'rättvisa',
  utilitarianism: 'utilitarism',
  virtue: 'dygd',
  authority: 'auktoritet',
  care: 'omsorg',
  equality: 'jämlikhet',
  loyalty: 'lojalitet',
  proportionality: 'proportionalitet',
  purity: 'renhet',
  fairness: 'rättvisa',
}
const name = (s: string) => cap(l(s, SV[s] ?? s))

/** Subsets in file order: the benchmark's parts differ in format, so they are not ranked. */
const subsets = (d: Ethics) => [...new Set(d.subsets.map((s) => s.subset))]

function EthicsDots() {
  return (
    <Frame data={useData<Ethics>(ETHICS)}>
      {(d) => {
        const names = subsets(d)
        if (!names.length) return null
        const L = 100,
          R = 250,
          T = 18,
          step = (176 - T) / names.length
        const x = linearScale([0.5, 1], [L, R])
        return (
          <Svg
            w={300}
            h={200}
            label={l(
              'Model accuracy on five ETHICS subsets, two wordings, against always guessing the most common label',
              'Modellens träffsäkerhet på fem delar av ETHICS, två formuleringar, mot att alltid gissa den vanligaste etiketten',
            )}
          >
            <g className="mean-axis">
              {[0.5, 0.75, 1].map((v) => (
                <line key={v} x1={x(v)} x2={x(v)} y1={T - 8} y2={176} />
              ))}
            </g>
            {names.map((n, i) => {
              const rows = d.subsets.filter((s) => s.subset === n)
              const cy = T + step * (i + 0.5)
              const base = rows[0].majority_accuracy
              return (
                <g key={n}>
                  <text
                    x={L - 8}
                    y={cy}
                    dy="0.35em"
                    textAnchor="end"
                    style={{ fill: 'var(--mean-ink)' }}
                  >
                    {name(n)}
                  </text>
                  <line
                    x1={x(base)}
                    x2={x(base)}
                    y1={cy - 8}
                    y2={cy + 8}
                    stroke={OTHER}
                    strokeWidth={2.5}
                  />
                  {rows.map((r, k) => {
                    const yy = cy + (k - (rows.length - 1) / 2) * 6
                    return (
                      <g key={r.wording}>
                        <line
                          x1={x(r.accuracy_ci_low)}
                          x2={x(r.accuracy_ci_high)}
                          y1={yy}
                          y2={yy}
                          stroke={focal(true)}
                          strokeWidth={1.2}
                        />
                        <circle
                          cx={x(r.accuracy)}
                          cy={yy}
                          r={2.8}
                          fill={focal(true)}
                        />
                      </g>
                    )
                  })}
                  {i === 0 && (
                    <text x={x(base)} y={cy - 12} textAnchor="middle">
                      {l('guess', 'gissning')}
                    </text>
                  )}
                </g>
              )
            })}
            <XAxis
              x={x}
              y={196}
              ticks={[0.5, 0.75, 1].map((v) => ({ value: v, label: pc(v) }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

const byTagger = (d: Foundations) =>
  [...d.english].sort(
    (a, b) => b.tagger_vs_annotator_f1 - a.tagger_vs_annotator_f1,
  )

function CeilingDumbbell() {
  return (
    <Frame data={useData<Foundations>(FOUNDATIONS)}>
      {(d) => {
        const rows = byTagger(d)
        if (!rows.length) return null
        const L = 110,
          R = 260,
          T = 22,
          step = (176 - T) / rows.length
        const x = linearScale([0, 0.5], [L, R])
        return (
          <Svg
            w={300}
            h={200}
            label={l(
              'F1 of the moral-foundations tagger against single annotators, beside annotators against each other',
              'F1 för taggaren av moraliska grunder mot enskilda annoterare, bredvid annoterare mot varandra',
            )}
          >
            <g className="mean-axis">
              {[0, 0.25, 0.5].map((v) => (
                <line key={v} x1={x(v)} x2={x(v)} y1={T - 8} y2={176} />
              ))}
            </g>
            {rows.map((r, i) => {
              const cy = T + step * (i + 0.5)
              const [h, t] = [r.human_pair_f1, r.tagger_vs_annotator_f1]
              return (
                <g key={r.foundation}>
                  <text
                    x={L - 8}
                    y={cy}
                    dy="0.35em"
                    textAnchor="end"
                    style={{ fill: 'var(--mean-ink)' }}
                  >
                    {name(r.foundation)}
                  </text>
                  <line
                    x1={x(h)}
                    x2={x(t)}
                    y1={cy}
                    y2={cy}
                    stroke={OTHER}
                    strokeWidth={1.5}
                  />
                  <circle cx={x(h)} cy={cy} r={3.2} fill={OTHER} />
                  <circle cx={x(t)} cy={cy} r={4} fill={focal(true)} />
                  {i === 0 && (
                    <>
                      <text
                        x={x(t) + 2}
                        y={cy - 10}
                        textAnchor="start"
                        style={{ fill: focal(true) }}
                      >
                        {l('tagger', 'taggare')}
                      </text>
                      <text x={x(h) - 2} y={cy - 10} textAnchor="end">
                        {l('people', 'människor')}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
            <XAxis
              x={x}
              y={196}
              ticks={[0, 0.25, 0.5].map((v) => ({ value: v, label: f1(v) }))}
            />
          </Svg>
        )
      }}
    </Frame>
  )
}

export const posts: Post[] = [
  {
    id: 'txt-ml-ethics-dots',
    domain: 'ml',
    sources: ['philosophy/moral/ethics.json'],
    title: (d: Ethics) => {
      if (!d.subsets.length)
        return l(
          'A model against human moral labels',
          'En modell mot människors moraliska etiketter',
        )
      const beat = subsets(d).filter((n) =>
        d.subsets
          .filter((s) => s.subset === n)
          .every((s) => s.accuracy_ci_low > s.majority_accuracy),
      )
      const lo = Math.min(...d.subsets.map((s) => s.accuracy))
      const hi = Math.max(...d.subsets.map((s) => s.accuracy))
      const all = subsets(d).length
      return l(
        `An open model agreed with human moral labels ${Math.round(lo * 100)}–${pc(hi)} of the time, above guessing in ${beat.length === all ? `all ${all}` : `${beat.length} of ${all}`} tests`,
        `En öppen modell höll med människors moraliska etiketter i ${Math.round(lo * 100)}–${pc(hi)} av fallen, bättre än gissning i ${beat.length === all ? `alla ${all}` : `${beat.length} av ${all}`} test`,
      )
    },
    note: [
      'Accuracy on 200 items per test, 95 % intervals. Grey tick: always guessing the most common label. Gemma on Workers AI',
      'Träffsäkerhet på 200 uppgifter per test, 95 %-intervall. Grått streck: att alltid gissa den vanligaste etiketten. Gemma på Workers AI',
    ],
    render: () => <EthicsDots />,
  },
  {
    id: 'txt-ml-foundations-ceiling',
    domain: 'ml',
    sources: ['philosophy/moral/foundations.json'],
    title: (d: Foundations) => {
      const n = d.english.length
      if (!n)
        return l(
          'A moral-foundations tagger beside human annotators',
          'En taggare av moraliska grunder bredvid mänskliga annoterare',
        )
      // Counted by the 95 % interval of the gap, not by point estimates.
      const above = d.english.filter((r) => r.ceiling_gap_low > 0).length
      const close = d.english.filter(
        (r) => r.ceiling_gap_low <= 0 && r.ceiling_gap_high >= 0,
      ).length
      return l(
        `In ${above} of ${n} moral foundations, a tagger agrees with one annotator more than two annotators agree${close ? `; ${close} too close to call` : ''}`,
        `I ${above} av ${n} moraliska grunder håller en taggare med en annoterare mer än två annoterare håller med varandra${close ? `; ${close} för jämna för att avgöra` : ''}`,
      )
    },
    note: [
      'F1 on English Reddit comments (MFRC): tagger against annotators, and annotators against each other. Both are low',
      'F1 på engelska Reddit-kommentarer (MFRC): taggaren mot annoterare, och annoterare mot varandra. Båda är låga',
    ],
    render: () => <CeilingDumbbell />,
  },
]
