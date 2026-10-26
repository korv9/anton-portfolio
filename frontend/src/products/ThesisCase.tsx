/**
 * The degree project (#thesis): IT incident clustering at Fora AB. Aggregates only: no ticket
 * text, cluster ids or internal codes. Every figure is in FACTS below with its source.
 */
import { currentLocale, l } from '../i18n'
import { ProjectHero, ProjectSection } from '../ui/Project'
import './thesis.css'

/** ER = docs/thesis-evidence-review.md; p. = page of the thesis PDF. */
export const FACTS = {
  records: 21_633, // ER "Population och urval"; p. 13, 18
  selectedRun: 16_811, // ER "Population och urval": the text_weighted run; p. 26-29
  clusters: 121, // ER "Klustring": HDBSCAN 30/15; p. 29
  unlinked: 72, // ER "Problemkopplingar"; p. 30, 32
  unlinkedTickets: 5_605, // ER "Problemkopplingar"
  highlighted: { groups: 12, tickets: 650 }, // ER "Problemkopplingar"; p. 33, 36
  /** Tickets of the selected run by outcome; sums to 16,811. p. 44 (figure legend). */
  split: { linked: 613, clustered: 11_539, noise: 4_659 },
  noisePct: 27.7, // ER "Jämförelse och utvärdering"; p. 29, 38, 42
  silhouette: { hdbscan: 0.706, kmeans: 0.534, kmeansClusters: 73 }, // ER "Jämförelse och utvärdering"
  /** ISO/IEC 25012, ER "Utökning av ISO-resultat" (p. 19-25). Percent of the 21,633 records. */
  iso: {
    analysis: 4.2, // completeness, p. 19-20
    solutionFilled: 82.2, // completeness, p. 19
    solutionManual: 3.8, // completeness, p. 19
    categories: 15, // accuracy, p. 21-22
    subCategories: 50, // accuracy, p. 21-22
    statusValid: 100, // consistency, system-enforced, p. 23
    unique: 92.8, // uniqueness, p. 23-24
    unique2021: 82.8, // uniqueness, p. 24
    linked: 5.1, // traceability, p. 24-25
    linked2026: 15.7, // traceability, p. 24-25
  },
  /** Fill rate per year, p. 20; ER "Utökning av ISO-resultat" confirms 99.9 % (2026) and the
      analysis field's 11.7 % (2025) and 13.3 % (2026). 2026 is a partial year. */
  years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
  category: [4.6, 2.3, 17.2, 52.3, 79.8, 80.4, 99.9],
  analysisByYear: [0, 0, 0, 0, 2.0, 11.7, 13.3],
} as const

const locale = () => (currentLocale() === 'sv' ? 'sv-SE' : 'en-GB')
const num = (n: number) => n.toLocaleString(locale())
const pct = (n: number) =>
  l(`${n.toLocaleString('en-GB')}%`, `${n.toLocaleString('sv-SE')} %`)

function Stats() {
  const items: [string, string][] = [
    [
      num(FACTS.records),
      l(
        'incident records assessed, 2020-2026',
        'incidentposter granskade, 2020-2026',
      ),
    ],
    [
      num(FACTS.clusters),
      l(
        `clusters from the ${num(FACTS.selectedRun)} tickets of the selected run`,
        `kluster ur den valda körningens ${num(FACTS.selectedRun)} ärenden`,
      ),
    ],
    [
      num(FACTS.unlinked),
      l(
        'of those clusters without a link to a registered problem',
        'av dem utan koppling till ett registrerat problem',
      ),
    ],
  ]
  return (
    <dl className="thesis-stats">
      {items.map(([value, label]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ClusterGrid() {
  const { clusters, unlinked, unlinkedTickets, selectedRun, split } = FACTS
  const total = selectedRun
  const parts = [
    {
      key: 'linked',
      n: split.linked,
      label: l('with a problem link', 'med problemkoppling'),
    },
    {
      key: 'clustered',
      n: split.clustered,
      label: l('clustered, no problem link', 'klustrade, utan problemkoppling'),
    },
    {
      key: 'noise',
      n: split.noise,
      label: l(
        `noise, in no cluster (${pct(FACTS.noisePct)})`,
        `brus, i inget kluster (${pct(FACTS.noisePct)})`,
      ),
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
            {l('tickets in the selected run', 'ärenden i den valda körningen')}
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
            <strong>{num(p.n)}</strong> {p.label}
          </li>
        ))}
      </ul>
      <figcaption>
        {l(
          `One dot per cluster, ${clusters} in all. The ${unlinked} bright ones have no ticket linked to a registered problem. The bar splits all ${num(total)} tickets of the run.`,
          `En prick per kluster, ${clusters} totalt. De ${unlinked} ljusa har inget ärende kopplat till ett registrerat problem. Stapeln delar upp körningens alla ${num(total)} ärenden.`,
        )}
      </figcaption>
    </figure>
  )
}

type Bar = { value: number; label: string; muted?: boolean }

function QualityStrip() {
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

function Maturity() {
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

export function ThesisPage() {
  const { iso, silhouette, highlighted } = FACTS
  return (
    <article className="project-page thesis-page">
      <ProjectHero
        project="thesis"
        title={l(
          'Finding recurring problems in IT support data',
          'Att hitta återkommande problem i IT-supportdata',
        )}
        question={l(
          'Using NLP and unsupervised learning to uncover recurring IT issues and explore how data quality affects the usefulness of AI.',
          'Med NLP och oövervakad inlärning sökte jag återkommande IT-fel och undersökte hur datakvaliteten påverkar nyttan av AI.',
        )}
      >
        <Stats />
      </ProjectHero>
      <ProjectSection
        id="thesis-motivation"
        title={l('Why I chose this project', 'Varför jag valde projektet')}
      >
        <p>
          {l(
            'Recurring IT problems can hide in thousands of tickets handled one at a time. For my degree project at Fora AB, I tested whether clustering could connect them, on real data with gaps in the documentation and personal data to protect.',
            'Återkommande IT-fel kan gömma sig i tusentals ärenden som hanteras ett i taget. I mitt examensarbete hos Fora AB prövade jag om klustring kunde koppla ihop dem, på riktig data med luckor i dokumentationen och personuppgifter att skydda.',
          )}
        </p>
      </ProjectSection>
      <ProjectSection
        id="thesis-workflow"
        title={l('What I did', 'Vad jag gjorde')}
      >
        <p>
          {l(
            `I assessed ${num(FACTS.records)} incident records against five ISO/IEC 25012 data-quality dimensions, masked personal data locally, and clustered the ${num(FACTS.selectedRun)} tickets of the selected run.`,
            `Jag granskade ${num(FACTS.records)} incidentposter mot fem datakvalitetsdimensioner ur ISO/IEC 25012, maskerade personuppgifter lokalt och klustrade den valda körningens ${num(FACTS.selectedRun)} ärenden.`,
          )}
        </p>
        <p>
          {l(
            'A multilingual sentence model embedded each ticket, UMAP reduced it to ten dimensions and HDBSCAN grouped similar incidents. I compared the clusters with existing problem links.',
            'En flerspråkig meningsmodell gjorde varje ärende till en vektor, UMAP reducerade till tio dimensioner och HDBSCAN grupperade liknande incidenter. Jag jämförde klustren med befintliga problemkopplingar.',
          )}
        </p>
        <p>
          {l(
            `Silhouette in UMAP space: HDBSCAN ${silhouette.hdbscan.toLocaleString(locale())}, K-means (${silhouette.kmeansClusters} clusters) ${silhouette.kmeans.toLocaleString(locale())}. Not like for like: HDBSCAN scores only the tickets it clusters.`,
            `Silhuett i UMAP-rymden: HDBSCAN ${silhouette.hdbscan.toLocaleString(locale())}, K-means (${silhouette.kmeansClusters} kluster) ${silhouette.kmeans.toLocaleString(locale())}. Inte jämförbart rakt av: HDBSCAN mäts bara på de ärenden det klustrar.`,
          )}
        </p>
      </ProjectSection>
      <ProjectSection
        id="thesis-quality"
        title={l('What I found', 'Vad jag fann')}
      >
        <p>
          {l(
            `${FACTS.clusters} clusters of related incidents. ${FACTS.unlinked} had no link to a problem record: candidates for review rather than confirmed root causes. The thesis highlighted ${highlighted.groups} groups with ${num(highlighted.tickets)} tickets.`,
            `${FACTS.clusters} kluster av relaterade incidenter. ${FACTS.unlinked} saknade koppling till en problempost: kandidater att granska, inte bekräftade rotorsaker. Arbetet lyfte fram ${highlighted.groups} grupper med ${num(highlighted.tickets)} ärenden.`,
          )}
        </p>
        <ClusterGrid />
        <p>
          {l(
            `Documentation was the main limit. The root-cause field was filled in only ${pct(iso.analysis)} of records, so the text recipe weights it ×4. The solution field looked ${pct(iso.solutionFilled)} complete, but only ${pct(iso.solutionManual)} written by hand.`,
            `Dokumentationen var den största begränsningen. Rotorsaksfältet var ifyllt i bara ${pct(iso.analysis)} av posterna, så textreceptet viktar det ×4. Lösningsfältet såg ${pct(iso.solutionFilled)} komplett ut, men bara ${pct(iso.solutionManual)} var skrivet för hand.`,
          )}
        </p>
        <QualityStrip />
        <p>
          {l(
            `Required fields went from almost empty to ${pct(FACTS.category[6])} filled. The voluntary root-cause field reached ${pct(FACTS.analysisByYear[5])} in 2025 and ${pct(FACTS.analysisByYear[6])} in 2026.`,
            `Obligatoriska fält gick från nästan tomma till ${pct(FACTS.category[6])} ifyllda. Det frivilliga rotorsaksfältet nådde ${pct(FACTS.analysisByYear[5])} år 2025 och ${pct(FACTS.analysisByYear[6])} år 2026.`,
          )}
        </p>
        <Maturity />
        <p>
          {l(
            'Masking placeholders could pull unrelated tickets with the same subject template into one cluster.',
            'Maskeringens platshållare kunde dra ihop orelaterade ärenden med samma ämnesmall i ett kluster.',
          )}
        </p>
      </ProjectSection>
      <ProjectSection
        id="thesis-evaluation"
        title={l('Why it matters', 'Varför det spelar roll')}
      >
        <p>
          {l(
            'Useful AI depends on the information behind it. Better documentation and clearer problem links can matter as much as a better model.',
            'Användbar AI beror på informationen bakom den. Bättre dokumentation och tydligare problemkopplingar kan betyda lika mycket som en bättre modell.',
          )}
        </p>
        <p>
          {l(
            'The result is a pipeline and candidate patterns. Its effect on workload, costs and resolution times would need to be evaluated through operational use.',
            'Resultatet är ett analysflöde och kandidatmönster. Effekten på arbetsbörda, kostnader och lösningstider skulle behöva utvärderas i verklig drift.',
          )}
        </p>
      </ProjectSection>
    </article>
  )
}
