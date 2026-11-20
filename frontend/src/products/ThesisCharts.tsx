/**
 * The degree project's three figures for #thesis (ThesisCase.tsx): the clusters, the
 * ISO/IEC 25012 measures and the fill rate per year. Every figure is in FACTS with its page.
 */
import { l } from '../i18n'
import { FACTS, num, pct } from './thesisFacts'

export function ClusterGrid() {
  const { clusters, unlinked, unlinkedTickets, selectedRun } = FACTS
  const parts = [
    {
      key: 'clustered',
      n: FACTS.clusteredPct,
      label: l('in a cluster', 'i ett kluster'),
    },
    {
      key: 'noise',
      n: FACTS.noisePct,
      label: l('noise, in no cluster', 'brus, i inget kluster'),
    },
  ]
  return (
    <figure className="thesis-figure thesis-clusters">
      <div className="thesis-clusters-body">
        <div
          className="thesis-grid"
          role="img"
          aria-label={l(
            `${clusters} clusters, ${unlinked} of them without a problem link`,
            `${clusters} kluster, varav ${unlinked} utan problemkoppling`,
          )}
        >
          {Array.from({ length: clusters }, (_, i) => (
            <span
              key={i}
              className={`thesis-dot${i < unlinked ? ' is-open' : ''}`}
            />
          ))}
        </div>
        <ol className="thesis-funnel">
          <li>
            <strong>{num(selectedRun)}</strong>
            {l('tickets in the final run', 'ärenden i den slutliga körningen')}
          </li>
          <li>
            <strong>{num(clusters)}</strong>
            {l('clusters of similar tickets', 'kluster av liknande ärenden')}
          </li>
          <li>
            <strong>{num(unlinked)}</strong>
            {l(
              `clusters without a problem link, ${num(unlinkedTickets)} tickets`,
              `kluster utan problemkoppling, ${num(unlinkedTickets)} ärenden`,
            )}
          </li>
        </ol>
      </div>
      <div className="thesis-split" aria-hidden="true">
        {parts.map((p) => (
          <span
            key={p.key}
            className={`thesis-split-${p.key}`}
            style={{ flexGrow: p.n }}
          />
        ))}
      </div>
      <ul className="thesis-split-legend">
        {parts.map((p) => (
          <li key={p.key} className={`thesis-split-${p.key}`}>
            <strong>{pct(p.n)}</strong> {p.label}
          </li>
        ))}
      </ul>
      <figcaption>
        {l(
          `One dot per cluster, ${clusters} in all. The ${unlinked} bright ones have no ticket linked to a registered problem. The bar splits the ${num(selectedRun)} tickets of the run.`,
          `En prick per kluster, ${clusters} totalt. De ${unlinked} ljusa har inget ärende kopplat till ett registrerat problem. Stapeln delar upp körningens ${num(selectedRun)} ärenden.`,
        )}
      </figcaption>
    </figure>
  )
}

type Bar = { value: number; label: string; muted?: boolean }

export function QualityStrip() {
  const { iso } = FACTS
  const rows: { dim: string; what: string; bars: Bar[]; note?: string }[] = [
    {
      dim: l('Completeness', 'Fullständighet'),
      what: l('Analysis field filled', 'Analysfältet ifyllt'),
      bars: [{ value: iso.analysis, label: pct(iso.analysis) }],
    },
    {
      dim: l('Completeness', 'Fullständighet'),
      what: l('Solution field', 'Lösningsfältet'),
      bars: [
        {
          value: iso.solutionFilled,
          label: l(
            `${pct(iso.solutionFilled)} filled`,
            `${pct(iso.solutionFilled)} ifyllt`,
          ),
          muted: true,
        },
        {
          value: iso.solutionManual,
          label: l(
            `${pct(iso.solutionManual)} written by hand`,
            `${pct(iso.solutionManual)} skrivet för hand`,
          ),
        },
      ],
      note: l(
        'Most of the filled values were standard text the system inserted.',
        'De flesta ifyllda värden var standardtext som systemet infogade.',
      ),
    },
    {
      dim: l('Accuracy', 'Exakthet'),
      what: l('Category detail', 'Kategoriernas detaljnivå'),
      bars: [],
      note: l(
        `${iso.categories} categories and ${iso.subCategories} sub-categories for all incidents, and no independent reference per ticket.`,
        `${iso.categories} kategorier och ${iso.subCategories} underkategorier för alla incidenter, och inget oberoende facit per ärende.`,
      ),
    },
    {
      dim: l('Consistency', 'Konsistens'),
      what: l('Valid status and priority', 'Giltig status och prioritet'),
      bars: [{ value: iso.statusValid, label: pct(iso.statusValid) }],
      note: l(
        'Enforced by the system, so it says nothing about the judgement behind them.',
        'Systemet kräver det, så det säger inget om bedömningen bakom.',
      ),
    },
    {
      dim: l('Uniqueness', 'Unikhet'),
      what: l('Not duplicates', 'Inte dubbletter'),
      bars: [{ value: iso.unique, label: pct(iso.unique) }],
      note: l(
        `${pct(iso.unique2021)} in 2021.`,
        `${pct(iso.unique2021)} år 2021.`,
      ),
    },
    {
      dim: l('Traceability', 'Spårbarhet'),
      what: l('Linked to a registered problem', 'Kopplat till ett problem'),
      bars: [{ value: iso.linked, label: pct(iso.linked) }],
      note: l(
        `${pct(iso.linked2026)} in the partial year 2026.`,
        `${pct(iso.linked2026)} under delåret 2026.`,
      ),
    },
  ]
  return (
    <figure className="thesis-figure">
      <ul className="thesis-quality">
        {rows.map((r) => (
          <li key={r.what}>
            <span className="thesis-quality-dim">{r.dim}</span>
            <span className="thesis-quality-what">{r.what}</span>
            <span className="thesis-quality-bars">
              {r.bars.map((b) => (
                <span key={b.label} className="thesis-bar">
                  <span className="thesis-bar-track">
                    <span
                      className={`thesis-bar-fill${b.muted ? ' is-muted' : ''}`}
                      style={{ width: `${b.value}%` }}
                    />
                  </span>
                  <span className="thesis-bar-label">{b.label}</span>
                </span>
              ))}
              {r.note && <span className="thesis-quality-note">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      <figcaption>
        {l(
          `Five ISO/IEC 25012 dimensions, measured on all ${num(FACTS.records)} records.`,
          `Fem dimensioner ur ISO/IEC 25012, mätta på alla ${num(FACTS.records)} poster.`,
        )}
      </figcaption>
    </figure>
  )
}

export function Maturity() {
  const { years, category, analysisByYear } = FACTS
  return (
    <figure className="thesis-figure">
      <div
        className="thesis-years"
        role="img"
        aria-label={l(
          `Category field filled ${pct(category[0])} in ${years[0]} and ${pct(category[6])} in ${years[6]}; analysis field ${pct(analysisByYear[0])} and ${pct(analysisByYear[6])}.`,
          `Kategorifältet ifyllt ${pct(category[0])} år ${years[0]} och ${pct(category[6])} år ${years[6]}; analysfältet ${pct(analysisByYear[0])} och ${pct(analysisByYear[6])}.`,
        )}
      >
        {years.map((y, i) => (
          <div key={y}>
            <span className="thesis-years-bars">
              <span
                className="thesis-years-bar is-muted"
                style={{ height: `${category[i]}%` }}
              />
              <span
                className="thesis-years-bar"
                style={{ height: `${analysisByYear[i]}%` }}
              />
            </span>
            <span className="thesis-years-label">
              {y === 2026 ? `${y}*` : y}
            </span>
          </div>
        ))}
      </div>
      <ul className="thesis-years-legend">
        <li className="is-muted">
          {l(
            `Category, required by the system: ${pct(category[0])} → ${pct(category[6])}`,
            `Kategori, krävs av systemet: ${pct(category[0])} → ${pct(category[6])}`,
          )}
        </li>
        <li>
          {l(
            `Root-cause analysis, voluntary: ${pct(analysisByYear[0])} → ${pct(analysisByYear[6])}`,
            `Rotorsaksanalys, frivillig: ${pct(analysisByYear[0])} → ${pct(analysisByYear[6])}`,
          )}
        </li>
      </ul>
      <figcaption>
        {l(
          'Share of records with the field filled, per year. *2026 is a partial year.',
          'Andel poster med fältet ifyllt, per år. *2026 är ett delår.',
        )}
      </figcaption>
    </figure>
  )
}
