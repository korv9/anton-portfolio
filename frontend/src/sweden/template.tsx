/**
 * The page every SWEDEN research product uses, in a fixed order:
 * scene → findings (at most three) → explore → method & limitations → interpretations → related.
 *
 * The scene is the visual entry; its four overlay slots keep the same place on every page
 * (title top left, legend top right, primary control bottom left, selected entity bottom right).
 * A slot left out stays empty. Every scene needs a 2D or tabular equivalent under Explore.
 * Nothing here holds a finding: pages compute their statements from published data, and a
 * product without validated data shows an EmptyState instead of cards.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { l } from '../i18n'
import { ExploreSection } from '../ui/Story'
import {
  productById,
  type Evidence,
  type Status,
  type SwedenProduct,
} from './products'
import { SwedenHeader } from './Header'
import './sweden.css'

const b = (text: { en: string; sv: string }) => l(text.en, text.sv)

const STATUS: Record<Status, [string, string]> = {
  findings: ['Findings available', 'Resultat finns'],
  pipeline: [
    'Pipeline ready, awaiting execution',
    'Pipeline klar, väntar på körning',
  ],
  unavailable: ['Data unavailable', 'Data saknas'],
}
const EVIDENCE: Record<Evidence, [string, string]> = {
  descriptive: ['Descriptive', 'Beskrivande'],
  exploratory: ['Exploratory', 'Explorativ'],
  causal: ['Causally identified', 'Kausalt identifierad'],
}

export function StatusStamp({ status }: { status: Status }) {
  return (
    <span className="sw-stamp" data-status={status}>
      {l(...STATUS[status])}
    </span>
  )
}

export function EvidenceStamp({ evidence }: { evidence: Evidence }) {
  return (
    <span className="sw-stamp sw-evidence" data-evidence={evidence}>
      {l('Evidence', 'Evidens')}: {l(...EVIDENCE[evidence])}
    </span>
  )
}

export type Finding = {
  key: string
  statement: ReactNode
  /** The measured values, with units, period and comparison. */
  values: ReactNode
  evidence: Evidence
  source: ReactNode
  /** Contradicts or complicates the starting expectation: shown after the leading findings, and marked. */
  contrary?: boolean
  /** Highlights the finding in the scene, when the scene supports it. */
  onShow?: () => void
}

/**
 * A finding as a numbered button in the scene's title panel. Choosing it shows its values,
 * evidence and source under the statement, and moves the scene when the page can (onShow).
 */
function FindingButton({ finding, n }: { finding: Finding; n: number }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="sw-find" data-contrary={finding.contrary || undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open)
          if (!open) finding.onShow?.()
        }}
      >
        <span className="sw-find-n">{String(n).padStart(2, '0')}</span>
        <span>
          {finding.contrary && (
            <span className="sw-finding-flag">
              {l('Against the expectation', 'Mot förväntningen')}
            </span>
          )}
          {finding.statement}
        </span>
      </button>
      {open && (
        <div className="sw-find-more">
          <div className="sw-finding-values">{finding.values}</div>
          <p>
            <EvidenceStamp evidence={finding.evidence} />{' '}
            <span className="sw-source">{finding.source}</span>
          </p>
        </div>
      )}
    </li>
  )
}

const FindingsContext = createContext<Finding[]>([])

/** What a page would show, what it needs, and what to explore meanwhile. */
export function EmptyState({
  shows,
  needs,
  state,
  meanwhile,
}: {
  shows: ReactNode
  needs: ReactNode
  state: 'ingestion' | 'validation' | 'licence' | 'cloud'
  meanwhile?: ReactNode
}) {
  const waiting = {
    ingestion: l('Awaiting ingestion', 'Väntar på inläsning'),
    validation: l('Awaiting validation', 'Väntar på validering'),
    licence: l('Awaiting licence review', 'Väntar på licensgranskning'),
    cloud: l('Awaiting cloud execution', 'Väntar på molnkörning'),
  }[state]
  return (
    <div className="sw-empty" role="status">
      <p className="sw-empty-state">{waiting}</p>
      <dl>
        <div>
          <dt>{l('What this will show', 'Vad det ska visa')}</dt>
          <dd>{shows}</dd>
        </div>
        <div>
          <dt>{l('What it needs', 'Vad som krävs')}</dt>
          <dd>{needs}</dd>
        </div>
        {meanwhile && (
          <div>
            <dt>{l('Meanwhile', 'Under tiden')}</dt>
            <dd>{meanwhile}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

export type Method = {
  question: ReactNode
  theory: ReactNode
  data: ReactNode
  method: ReactNode
  results: ReactNode
  alternatives: ReactNode
  limitations: ReactNode
  references: ReactNode
  reproducibility: ReactNode
}

const METHOD_PARTS: [keyof Method, string, string][] = [
  ['question', 'Research question', 'Forskningsfråga'],
  ['theory', 'Theoretical background', 'Teoretisk bakgrund'],
  ['data', 'Data and sources', 'Data och källor'],
  ['method', 'Methodology', 'Metod'],
  ['results', 'Observed results', 'Observerade resultat'],
  ['alternatives', 'Alternative explanations', 'Alternativa förklaringar'],
  ['limitations', 'Limitations', 'Begränsningar'],
  ['references', 'Source references', 'Källhänvisningar'],
  ['reproducibility', 'Reproducibility', 'Reproducerbarhet'],
]

/** The nine method sections, each a native disclosure so they open independently. */
export function MethodDrawer({ method }: { method: Method }) {
  return (
    <section className="sw-method" aria-labelledby="sw-method-title">
      <h2 id="sw-method-title">
        {l('Method and limitations', 'Metod och begränsningar')}
      </h2>
      {METHOD_PARTS.map(([key, en, sv], i) => (
        <details key={key} open={key === 'limitations'}>
          <summary>
            <span className="sw-num">{i + 1}</span> {l(en, sv)}
          </summary>
          <div className="sw-method-body">{method[key]}</div>
        </details>
      ))}
    </section>
  )
}

export type Reading = {
  theory: string
  expects: ReactNode
  verdict: 'supports' | 'challenges' | 'undetermined'
  why: ReactNode
  limits: ReactNode
}

export function Interpretations({ readings }: { readings: Reading[] }) {
  const verdict = {
    supports: l('The evidence supports this', 'Evidensen stöder detta'),
    challenges: l('The evidence challenges this', 'Evidensen talar emot detta'),
    undetermined: l('The evidence cannot decide', 'Evidensen kan inte avgöra'),
  }
  return (
    <section className="sw-readings" aria-labelledby="sw-readings-title">
      <h2 id="sw-readings-title">{l('Interpretations', 'Tolkningar')}</h2>
      <p className="sw-note">
        {l(
          'Theoretical readings of the same observations. They are lenses, not conclusions, and the evidence does not support them equally.',
          'Teoretiska läsningar av samma observationer. De är linser, inte slutsatser, och evidensen stöder dem inte lika mycket.',
        )}
      </p>
      <div className="sw-readings-grid">
        {readings.map((r) => (
          <article
            key={r.theory}
            className="sw-reading"
            data-verdict={r.verdict}
          >
            <h3>{r.theory}</h3>
            <p>
              <b>{l('Would expect', 'Skulle förvänta')}:</b> {r.expects}
            </p>
            <p className="sw-verdict">{verdict[r.verdict]}</p>
            <p>{r.why}</p>
            <p className="sw-note">
              <b>{l('Limits', 'Gränser')}:</b> {r.limits}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function RelatedProjects({ product }: { product: SwedenProduct }) {
  return (
    <section className="sw-related" aria-labelledby="sw-related-title">
      <h2 id="sw-related-title">
        {l('Related research', 'Relaterad forskning')}
      </h2>
      <ul>
        {product.related.map((r) => {
          const other = productById(r.id)
          return (
            <li key={r.id}>
              <a href={other.href}>
                <span className="sw-id">
                  {other.id === 'X' ? '×' : other.id}
                </span>
                <b>{b(other.title)}</b>
                <span>{b(r.why)}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The scene's fixed overlay slots around the visual itself. */
export function Scene({
  product,
  line,
  legend,
  control,
  info,
  children,
}: {
  product: SwedenProduct
  /** One sentence on what the scene shows. */
  line: ReactNode
  legend?: ReactNode
  control?: ReactNode
  info?: ReactNode
  children: ReactNode
}) {
  const findings = useContext(FindingsContext)
  return (
    <section className="sw-scene" aria-labelledby="sw-title">
      <div className="sw-scene-visual">{children}</div>
      <header className="sw-panel sw-scene-title">
        <p className="sw-kicker">
          SWEDEN · {product.id === 'X' ? '×' : product.id} · {b(product.title)}
          <StatusStamp status={product.status} />
        </p>
        <h1 id="sw-title">{b(product.question)}</h1>
        <p className="sw-line">{line}</p>
        {findings.length > 0 && (
          <ol className="sw-finds" aria-label={l('Findings', 'Resultat')}>
            {findings.map((f, i) => (
              <FindingButton key={f.key} finding={f} n={i + 1} />
            ))}
          </ol>
        )}
        {/* The hash names the route, so scroll in place instead of navigating. */}
        <a
          className="sw-more"
          href="#sw-below"
          onClick={(e) => {
            e.preventDefault()
            document.getElementById('sw-below')?.scrollIntoView()
          }}
        >
          {l(
            'Explore, method and interpretations',
            'Utforska, metod och tolkningar',
          )}{' '}
          ↓
        </a>
      </header>
      {legend && <aside className="sw-panel sw-scene-legend">{legend}</aside>}
      {control && <div className="sw-panel sw-scene-control">{control}</div>}
      {info && (
        <aside className="sw-panel sw-scene-info" aria-live="polite">
          {info}
        </aside>
      )}
    </section>
  )
}

export function SwedenResearchPage({
  product,
  scene,
  findings,
  explore,
  exploreSummary,
  method,
  readings,
}: {
  product: SwedenProduct
  scene: ReactNode
  findings: Finding[]
  explore: ReactNode
  exploreSummary: string
  method: Method
  readings: Reading[]
}) {
  // The strongest (first-listed) finding leads; a contrary one closes the three, never dropped.
  const against = findings.filter((f) => f.contrary)
  const ordered = [
    ...findings
      .filter((f) => !f.contrary)
      .slice(0, Math.max(1, 3 - against.length)),
    ...against,
  ].slice(0, 3)
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current={product.href} />
      <FindingsContext.Provider value={ordered}>
        {scene}
      </FindingsContext.Provider>
      <div className="sw-explore" id="sw-below">
        <ExploreSection summary={exploreSummary} defaultOpen>
          {explore}
        </ExploreSection>
      </div>
      <MethodDrawer method={method} />
      <Interpretations readings={readings} />
      <RelatedProjects product={product} />
    </article>
  )
}

/** Every SWEDEN page opens with the same header (Header.tsx), in place of the site header. */
export function SwedenMasthead({ current }: { current: string }) {
  return <SwedenHeader current={current} />
}

/** A product page without validated data: its masthead, question and an EmptyState. */
export function ProductEmpty({
  product,
  children,
}: {
  product: SwedenProduct
  /** The EmptyState. */
  children: ReactNode
}) {
  return (
    <article className="sweden sw-page">
      <SwedenMasthead current={product.href} />
      <Scene
        product={product}
        line={l('No validated data yet.', 'Inga validerade data ännu.')}
      >
        {children}
      </Scene>
      <RelatedProjects product={product} />
    </article>
  )
}

/**
 * 3D or 2D: 3D is the default where WebGL works (the scene falls back to 2D by itself), and the
 * reader can always switch to the 2D matrix, which is also the accessible view.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: 'matrix' | '3d'
  onChange: (view: 'matrix' | '3d') => void
}) {
  return (
    <div role="group" aria-label={l('View', 'Vy')} className="sw-view-toggle">
      <button
        type="button"
        aria-pressed={view === '3d'}
        onClick={() => onChange('3d')}
      >
        3D
      </button>
      <button
        type="button"
        aria-pressed={view === 'matrix'}
        onClick={() => onChange('matrix')}
      >
        2D
      </button>
    </div>
  )
}
