/**
 * Model cards (#platform-models): each model with its results, the gate in its card and the
 * verdict. Results and verdicts are read from ml/models.json; the gate wording is the card's.
 */
import { l } from '../i18n'
import { ok, unread, useFile } from './techData'
import './tech.css'

type Result = {
  model: string
  metric: string
  value: number
  interval: string | null
}
type Card = {
  task: string
  purpose: string
  card_url: string
  gate_passed: boolean
  published: boolean
  results: Result[]
}

// The gate as each card states it (ml/cards/*.md), and what decided the verdict.
const COPY: Record<string, () => [string, string]> = {
  polarization: () => [
    l(
      'How distinguishable party language is',
      'Hur särskiljbart partiernas språk är',
    ),
    l(
      'Beat a permutation null in 80% of sessions and keep mean pairwise AUC above 0.60. All 33 sessions cleared it, so the measure is published on the Replik page.',
      'Slå en permutationsnollmodell i 80 % av riksmötena och hålla genomsnittlig parvis AUC över 0,60. Alla 33 riksmöten klarade det, så måttet publiceras på sidan Replik.',
    ),
  ],
  policy_area: () => [
    l('Policy area of a debate passage', 'Politikområde för ett debattstycke'),
    l(
      'KB-BERT must beat TF-IDF by more than the width of the TF-IDF 95% interval. It scores higher, but the intervals overlap, so the cheaper model stays and nothing is published from this one.',
      'KB-BERT måste slå TF-IDF med mer än bredden på TF-IDF:s 95-procentsintervall. Den når högre, men intervallen överlappar, så den billigare modellen står kvar och inget publiceras från den här.',
    ),
  ],
  government_defeat: () => [
    l('Roll calls the government loses', 'Voteringar som regeringen förlorar'),
    l(
      'Rank defeats within each session better than the committee prior, with the lower bound of the paired bootstrap difference above zero. It ranks them at 0.68 against 0.53, so the per-session result is published.',
      'Rangordna nederlagen inom varje riksmöte bättre än utskottets grundfrekvens, med nedre gränsen för den parade bootstrapskillnaden över noll. Den når 0,68 mot 0,53, så resultatet per riksmöte publiceras.',
    ),
  ],
  reply: () => [
    l('Speeches that draw a reply', 'Anföranden som får replik'),
    l(
      'The opening words must add more than 0.01 AUC to party and place in the speaking order, judged by the lower bound of the paired bootstrap difference. They add 0.016, with a lower bound of 0.008, so nothing is published.',
      'Inledningsorden måste lägga till mer än 0,01 i AUC utöver parti och plats i talarordningen, bedömt på nedre gränsen för den parade bootstrapskillnaden. De lägger till 0,016 med nedre gräns 0,008, så inget publiceras.',
    ),
  ],
  seniority: () => [
    l('Junior share of job adverts', 'Juniorandel av platsannonser'),
    l(
      'AUC above 0.70, Brier below 0.20, and the calibrated junior share must beat plain counting. It ranks adverts well, but on employers it has not seen the calibrated share does not beat counting, so no share is published.',
      'AUC över 0,70, Brier under 0,20, och den kalibrerade juniorandelen måste slå enkel räkning. Den rangordnar annonser väl, men för arbetsgivare den inte sett slår den kalibrerade andelen inte räkning, så ingen andel publiceras.',
    ),
  ],
}

const fmt = (n: number) => l(n.toFixed(3), n.toFixed(3).replace('.', ','))

/** An interval on a 0–1 axis with its point; only for results that carry one. */
function Interval({ r }: { r: Result }) {
  const [lo, hi] = (r.interval ?? '').split('–').map(Number)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
  return (
    <span className="model-ci" aria-hidden="true">
      <span
        className="model-ci-range"
        style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }}
      />
      <span className="model-ci-dot" style={{ left: `${r.value * 100}%` }} />
    </span>
  )
}

/** `passedOnly` lists only models whose gate passed, for pages that show published results. */
export function ModelCards({ passedOnly = false }: { passedOnly?: boolean }) {
  const cards = useFile<Card[]>('ml/models.json')
  if (!ok(cards)) return unread
  return (
    <ul className="model-cards">
      {cards
        .filter((c) => !passedOnly || c.gate_passed)
        .map((c) => {
          const [title, gate] = COPY[c.task]?.() ?? [c.purpose, '']
          return (
            <li key={c.task} className="model-card">
              <h3>{title}</h3>
              <p
                className={`model-verdict ${c.gate_passed ? 'is-pass' : 'is-held'}`}
              >
                {c.gate_passed
                  ? l('Gate passed: shipped', 'Spärren klarad: publicerad')
                  : l('Held by its gate', 'Stoppad av sin spärr')}
              </p>
              <dl className="model-results">
                {c.results.map((r) => (
                  <div key={`${r.model}-${r.metric}`}>
                    <dt>
                      {r.model} · {r.metric}
                    </dt>
                    <dd>
                      <span className="model-value">{fmt(r.value)}</span>
                      {r.interval && (
                        <span className="tech-meta">
                          {' '}
                          {l('95% CI', '95 % KI')} {r.interval}
                        </span>
                      )}
                      <Interval r={r} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="tech-note">
                <strong>{l('Gate', 'Spärr')}:</strong> {gate}
              </p>
              <p className="tech-meta">
                <a href={c.card_url}>{l('Model card', 'Modellkort')}</a>
              </p>
            </li>
          )
        })}
    </ul>
  )
}
