/**
 * Every SWEDEN research product is one short section of the single #sweden page (SwedenPage.tsx):
 * letter and title, the question, the key findings with their values, one visual, and the
 * explore, method and readings folded away under one disclosure.
 *
 * Nothing here holds a finding: pages compute their statements from published data, and a
 * product without validated data shows an EmptyState instead.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { l } from '../i18n'
import { ExploreSection } from '../ui/Story'
import type { Evidence, SwedenProduct } from './products'
import './sweden.css'

const b = (text: { en: string; sv: string }) => l(text.en, text.sv)

const EVIDENCE: Record<Evidence, [string, string]> = {
  descriptive: ['Descriptive', 'Beskrivande'],
  exploratory: ['Exploratory', 'Explorativ'],
  causal: ['Causally identified', 'Kausalt identifierad'],
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

/** A finding: its statement and the values behind it, both always shown; a statement that can
 * move the scene (onShow) is a button. */
function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className="sw-find" data-contrary={finding.contrary || undefined}>
      {finding.onShow ? (
        <button type="button" onClick={finding.onShow}>
          {finding.statement}
        </button>
      ) : (
        <p>{finding.statement}</p>
      )}
      <div className="sw-finding-values">{finding.values}</div>
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

/** A product's head and visual: the question, its findings, then the visual and its panels. */
export function Scene({
  product,
  line,
  legend,
  control,
  info,
  children,
}: {
  product: SwedenProduct
  /** One sentence on what the visual shows. */
  line: ReactNode
  legend?: ReactNode
  control?: ReactNode
  info?: ReactNode
  children: ReactNode
}) {
  const findings = useContext(FindingsContext)
  const titleId = `sw-title-${product.id}`
  return (
    <div className="sw-scene" role="group" aria-labelledby={titleId}>
      <header className="sw-scene-title">
        <p className="sw-kicker">
          <span className="sw-id">{product.id === 'X' ? '×' : product.id}</span>
          {b(product.title)}
        </p>
        <h2 id={titleId}>{b(product.question)}</h2>
        {findings.length > 0 && (
          <ol className="sw-finds" aria-label={l('Findings', 'Resultat')}>
            {findings.map((f) => (
              <FindingItem key={f.key} finding={f} />
            ))}
          </ol>
        )}
      </header>
      <div className="sw-scene-visual">{children}</div>
      <p className="sw-line">{line}</p>
      {(legend || control || info) && (
        <div className="sw-scene-panels">
          {control && <div className="sw-scene-control">{control}</div>}
          {legend && <aside className="sw-scene-legend">{legend}</aside>}
          {info && (
            <aside className="sw-scene-info" aria-live="polite">
              {info}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

/** One product's section on the #sweden page. */
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
  // Two findings at most: the strongest, and a contrary one when there is one, never dropped.
  const against = findings.filter((f) => f.contrary)
  const ordered = [
    ...findings.filter((f) => !f.contrary).slice(0, against.length ? 1 : 2),
    ...against.slice(0, 1),
  ]
  return (
    <ProductSection product={product}>
      <FindingsContext.Provider value={ordered}>
        {scene}
      </FindingsContext.Provider>
      <ExploreSection
        title={l(
          'Explore, method and readings',
          'Utforska, metod och tolkningar',
        )}
        summary={exploreSummary}
      >
        {explore}
        <MethodDrawer method={method} />
        <Interpretations readings={readings} />
      </ExploreSection>
    </ProductSection>
  )
}

/** The section every product sits in; its id is what the product's address scrolls to. */
export function ProductSection({
  product,
  children,
}: {
  product: SwedenProduct
  children: ReactNode
}) {
  return (
    <section className="sw-section" id={sectionId(product)}>
      {children}
    </section>
  )
}

export const sectionId = (product: SwedenProduct) => `sw-${product.id}`

/** A product without validated data: its question and an EmptyState. */
export function ProductEmpty({
  product,
  children,
}: {
  product: SwedenProduct
  /** The EmptyState. */
  children: ReactNode
}) {
  return (
    <ProductSection product={product}>
      <Scene
        product={product}
        line={l('No validated data yet.', 'Inga validerade data ännu.')}
      >
        {children}
      </Scene>
    </ProductSection>
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
