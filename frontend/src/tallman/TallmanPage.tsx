/**
 * taLLMan: a source-critical chat about the Riksdag. Every answer is a list of claims,
 * each with its sources one click away and a label from Allegoria saying how well the sources
 * carry it. "Granska svaret" opens the whole trace: what was retrieved, what was claimed,
 * how each claim was judged, by which model, on which data.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { l } from '../i18n'
import { askQuestion, status, type Status } from './client'
import {
  LABEL_SV,
  type Answer,
  type CheckedClaim,
  type Label,
  type Passage,
} from './engine/types.ts'
import './tallman.css'

const LABEL_EN: Record<Label, string> = {
  direct: 'Directly supported',
  summary: 'Summary',
  computed: 'Computed',
  interpretation: 'Interpretation',
  insufficient: 'Insufficient evidence',
  conflict: 'Conflicting sources',
}

const LABEL_HELP: Record<Label, [string, string]> = {
  direct: [
    'A quote found word for word in the source, or figures the source states.',
    'Ett citat som står ordagrant i källan, eller siffror som källan anger.',
  ],
  computed: [
    'A figure derived from the sources’ values, or computed from the votes by the site’s pipeline.',
    'Ett tal som räknats fram ur källornas värden, eller som webbplatsens pipeline beräknat ur voteringarna.',
  ],
  summary: [
    'The sources’ content in other words.',
    'Källornas innehåll med andra ord.',
  ],
  interpretation: [
    'Goes beyond what the sources say: a reading, not a fact in them.',
    'Går utöver vad källorna säger: en tolkning, inte ett faktum i dem.',
  ],
  insufficient: [
    'No source, or a quote or figure the sources do not hold. Change over time also needs a reviewed annotation.',
    'Ingen källa, eller ett citat eller tal som källorna inte innehåller. Förändring över tid kräver dessutom en granskad annotering.',
  ],
  conflict: [
    'Two sources give different values for the same fact.',
    'Två källor ger olika värden för samma sak.',
  ],
}

const LABEL_ORDER: Label[] = [
  'direct',
  'computed',
  'summary',
  'interpretation',
  'insufficient',
  'conflict',
]

const EXAMPLES = [
  'Hur mycket skilde sig Socialdemokraternas och Centerpartiets budgetmotioner för 2026?',
  'Hur ofta röstade SD och M lika under riksmötet 2024/25?',
  'Vad sa Vänsterpartiet om straffbarhetsåldern?',
  'Vilket stöd har Liberalerna i SCB:s senaste mätning?',
  'Vad sades i debatten om ny kärnkraft?',
  'Har regeringen skärpt migrationspolitiken?',
]

const labelText = (label: Label) => l(LABEL_EN[label], LABEL_SV[label])

type Turn = { id: number; question: string; answer?: Answer; error?: string }

export default function TallmanPage() {
  const [engine, setEngine] = useState<Status | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const next = useRef(0)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    status().then(setEngine)
  }, [])

  async function submit(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const id = next.current++
    setTurns((t) => [{ id, question: q }, ...t])
    setQuestion('')
    setBusy(true)
    try {
      const answer = await askQuestion(q, engine?.via ?? 'browser')
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)))
    } catch (error) {
      setTurns((t) =>
        t.map((x) =>
          x.id === id ? { ...x, error: (error as Error).message } : x,
        ),
      )
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(question)
  }

  return (
    <div className="tallman ds-container">
      <header className="tallman-head">
        <p className="tallman-kicker">
          {l(
            'Source-critical chat · the Riksdag',
            'Källkritisk chatt · riksdagen',
          )}
        </p>
        <h1>taLLMan</h1>
        <p className="tallman-intro">
          {l(
            'Ask about budgets, votes, surveys and debates. Every answer is broken into claims; Allegoria checks each one against its sources and says how well they carry it.',
            'Fråga om budgetar, voteringar, opinionen och debatter. Varje svar delas upp i påståenden; Allegoria kontrollerar vart och ett mot sina källor och säger hur väl de bär det.',
          )}
        </p>
        <EngineLine engine={engine} />
      </header>

      <form className="tallman-form" onSubmit={onSubmit}>
        <label htmlFor="tallman-q" className="tallman-label">
          {l('Your question', 'Din fråga')}
        </label>
        <div className="tallman-row">
          <textarea
            id="tallman-q"
            ref={input}
            rows={2}
            maxLength={500}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(question)
              }
            }}
            placeholder={l(
              'E.g. How often did S and V vote alike in 2023/24?',
              'T.ex. Hur ofta röstade S och V lika 2023/24?',
            )}
          />
          <button type="submit" disabled={busy || !question.trim()}>
            {busy ? l('Checking…', 'Kontrollerar…') : l('Ask', 'Fråga')}
          </button>
        </div>
        <ul
          className="tallman-examples"
          aria-label={l('Example questions', 'Exempelfrågor')}
        >
          {EXAMPLES.map((q) => (
            <li key={q}>
              <button type="button" onClick={() => submit(q)} disabled={busy}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      </form>

      <div className="tallman-turns" aria-live="polite">
        {turns.map((turn) => (
          <article key={turn.id} className="tallman-turn">
            <h2 className="tallman-q">{turn.question}</h2>
            {turn.error ? (
              <p role="alert" className="theme-error">
                {turn.error}
              </p>
            ) : !turn.answer ? (
              <p className="theme-loading" role="status">
                {l(
                  'Retrieving sources and checking claims…',
                  'Hämtar källor och kontrollerar påståenden…',
                )}
              </p>
            ) : (
              <AnswerView answer={turn.answer} />
            )}
          </article>
        ))}
      </div>

      <details className="tallman-legend">
        <summary>
          {l('What the labels mean', 'Vad etiketterna betyder')}
        </summary>
        <dl>
          {LABEL_ORDER.map((label) => (
            <div key={label}>
              <dt>
                <span className={`tallman-chip ${label}`}>
                  {labelText(label)}
                </span>
              </dt>
              <dd>{l(...LABEL_HELP[label])}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  )
}

function EngineLine({ engine }: { engine: Status | null }) {
  if (!engine) return null
  const model = engine.llm
    ? `Claude (${engine.model})`
    : l('no language model (extractive)', 'ingen språkmodell (extraktivt)')
  const search = engine.vectors
    ? l('hybrid search (BM25 + vectors)', 'hybridsök (BM25 + vektorer)')
    : l('lexical search (BM25)', 'lexikal sökning (BM25)')
  const where =
    engine.via === 'worker'
      ? l('on the server', 'på servern')
      : l('in your browser', 'i din webbläsare')
  return (
    <p className="tallman-engine">
      {l('Engine', 'Motor')}: {model} · {search} · {where}
    </p>
  )
}

function sourceName(p: Passage): string {
  if (p.kind === 'speech') return `${p.speaker}, ${p.date}`
  const when = p.date ?? p.session ?? ''
  // The heading already names the source when it links to the original.
  const label = p.sourceLabel === p.title ? '' : p.sourceLabel
  return [label, when].filter(Boolean).join(', ')
}

function AnswerView({ answer }: { answer: Answer }) {
  const byId = new Map(answer.trace.passages.map((p) => [p.id, p]))
  // Number the sources in the order the claims first cite them.
  const cited: string[] = []
  for (const c of answer.claims)
    for (const id of c.sources)
      if (byId.has(id) && !cited.includes(id)) cited.push(id)

  return (
    <div className="tallman-answer">
      <p className="tallman-lead">{answer.lead}</p>
      <p className="tallman-meta">
        <span className={`tallman-certainty ${answer.certainty.toLowerCase()}`}>
          {l('Certainty', 'Säkerhet')}: {answer.certainty}
        </span>
        <span className="tallman-stats">{answer.statsLine}</span>
      </p>
      {answer.claims.length > 0 && (
        <ol className="tallman-claims">
          {answer.claims.map((claim) => (
            <ClaimView key={claim.id} claim={claim} cited={cited} byId={byId} />
          ))}
        </ol>
      )}
      {cited.length > 0 && (
        <ol className="tallman-sources" aria-label={l('Sources', 'Källor')}>
          {cited.map((id, i) => {
            const p = byId.get(id)!
            return (
              <li key={id}>
                <span className="tallman-source-no">{i + 1}</span>
                <span>
                  <b>{p.title}</b> · {sourceName(p)}{' '}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {l('original', 'originalet')} ↗
                    </a>
                  )}
                  {p.href && (
                    <>
                      {' '}
                      <a href={p.href}>{l('on this site', 'på webbplatsen')}</a>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <Trace answer={answer} />
    </div>
  )
}

function ClaimView({
  claim,
  cited,
  byId,
}: {
  claim: CheckedClaim
  cited: string[]
  byId: Map<string, Passage>
}) {
  return (
    <li className={`tallman-claim ${claim.label}`}>
      <span className={`tallman-chip ${claim.label}`}>
        {labelText(claim.label)}
      </span>
      <p>
        {claim.text}{' '}
        {claim.sources.map((id) => {
          const p = byId.get(id)
          if (!p) return null
          const n = cited.indexOf(id) + 1
          const link = p.url ?? p.href
          return (
            <a
              key={id}
              className="tallman-cite"
              href={link}
              {...(p.url ? { target: '_blank', rel: 'noreferrer' } : {})}
              title={`${p.title} · ${sourceName(p)}`}
              aria-label={`${l('Source', 'Källa')} ${n}: ${p.title}, ${sourceName(p)}`}
            >
              [{n}]
            </a>
          )
        })}
      </p>
      {claim.notes.length > 0 && (
        <p className="tallman-note">{claim.notes.join(' ')}</p>
      )}
    </li>
  )
}

function Trace({ answer }: { answer: Answer }) {
  const t = answer.trace
  const e = t.entities
  return (
    <details className="tallman-trace">
      <summary>{l('Review the answer', 'Granska svaret')}</summary>
      <dl className="tallman-trace-facts">
        <div>
          <dt>{l('Question', 'Fråga')}</dt>
          <dd>{t.question}</dd>
        </div>
        <div>
          <dt>{l('Understood as', 'Tolkad som')}</dt>
          <dd>
            {[
              e.parties.length &&
                `${l('parties', 'partier')}: ${e.parties.join(', ')}`,
              e.sessions.length &&
                `${l('sessions', 'riksmöten')}: ${e.sessions.join(', ')}`,
              e.years.length && `${l('years', 'år')}: ${e.years.join(', ')}`,
              e.intents.length &&
                `${l('asks about', 'frågar om')}: ${e.intents.join(', ')}`,
            ]
              .filter(Boolean)
              .join(' · ') || '–'}
          </dd>
        </div>
        <div>
          <dt>{l('Retrieval', 'Hämtning')}</dt>
          <dd>{t.retriever}</dd>
        </div>
        <div>
          <dt>{l('Model', 'Modell')}</dt>
          <dd>{t.model}</dd>
        </div>
        <div>
          <dt>{l('Data version', 'Dataversion')}</dt>
          <dd>{t.dataVersion}</dd>
        </div>
        <div>
          <dt>{l('Conflicts', 'Motstridigheter')}</dt>
          <dd>
            {t.conflicts.length
              ? t.conflicts.join('; ')
              : l('none found', 'inga funna')}
          </dd>
        </div>
        <div>
          <dt>{l('Time', 'Tid')}</dt>
          <dd>
            {Object.entries(t.timingsMs)
              .map(([k, v]) => `${k} ${v} ms`)
              .join(' · ')}
          </dd>
        </div>
      </dl>

      <h3>{l('Claims and evidence', 'Påståenden och belägg')}</h3>
      <div
        className="tallman-table-wrap"
        tabIndex={0}
        role="region"
        aria-label={l('Claims and evidence', 'Påståenden och belägg')}
      >
        <table className="tallman-table">
          <thead>
            <tr>
              <th scope="col">{l('Claim', 'Påstående')}</th>
              <th scope="col">{l('Proposed as', 'Föreslaget som')}</th>
              <th scope="col">{l('Label', 'Etikett')}</th>
              <th scope="col">{l('Word support', 'Ordstöd')}</th>
              <th scope="col">{l('Sources', 'Källor')}</th>
              <th scope="col">{l('Why', 'Varför')}</th>
            </tr>
          </thead>
          <tbody>
            {t.claims.map((c) => (
              <tr key={c.id}>
                <td>{c.text}</td>
                <td>{c.type}</td>
                <td>{labelText(c.label)}</td>
                <td>{Math.round(c.support * 100)} %</td>
                <td className="mono">{c.sources.join(' ')}</td>
                <td>{c.notes.join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>
        {l('Retrieved passages', 'Hämtade passager')} ({t.passages.length})
      </h3>
      <ol className="tallman-passages">
        {t.passages.map((p) => (
          <li key={p.id}>
            <p className="tallman-passage-head">
              <span className="mono">{p.id}</span> · {p.title} · {sourceName(p)}{' '}
              · {p.retriever} {p.score}
            </p>
            <p>{p.text}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}
