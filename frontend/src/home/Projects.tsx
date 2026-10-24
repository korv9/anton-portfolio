/** The work after the flagships: other repositories, then the research studies. */
import { l } from '../i18n'
import { PROJECTS } from '../projects/projectRegistry'
import { RESEARCH, type Bilingual } from './content'

const b = (text: Bilingual) => l(text.en, text.sv)
const t = (sv: string, en: string): Bilingual => ({ sv, en })

/** Other repositories; each card leads to its code on GitHub. */
const REPOS: {
  name: string
  title: Bilingual
  summary: Bilingual
  tech: string[]
}[] = [
  {
    name: 'DrugComb-Synergy-Prediction',
    title: t('Prediktion av läkemedelssynergi', 'DrugComb synergy prediction'),
    summary: t(
      'Slår ihop två öppna dataset från läkemedelsforskning i DuckDB och testar hur väl en LightGBM-modell förutsäger synergi mellan läkemedel under fyra olika uppdelningar av data.',
      'Joins two public drug-research datasets in DuckDB and tests how well a LightGBM model predicts drug-combination synergy under four evaluation splits.',
    ),
    tech: ['Python', 'DuckDB', 'SQL', 'LightGBM'],
  },
  {
    name: 'swedish-job-market-analytics',
    title: t(
      'Analys av svenska arbetsmarknaden',
      'Swedish job market analytics',
    ),
    summary: t(
      'En dbt-pipeline som gör fyra års platsannonser från Arbetsförmedlingen till trender för yrken, kompetenser och regioner.',
      'A dbt pipeline that turns four years of Arbetsförmedlingen job ads into role, skill and region trends.',
    ),
    tech: ['dbt', 'DuckDB', 'Python', 'Power BI'],
  },
  {
    name: 'diva-fabric-lakehouse',
    title: t('DiVA-lakehouse i Fabric', 'DiVA Fabric lakehouse'),
    summary: t(
      'Ett inkrementellt lakehouse i Microsoft Fabric för metadata om uppsatser i DiVA, med karantän och kvalitetskontroller. Omkörningar ger inga dubbletter.',
      'An incremental Microsoft Fabric lakehouse for DiVA thesis metadata, with quarantine and quality gates. Re-runs add no duplicates.',
    ),
    tech: ['PySpark', 'Delta Lake', 'Fabric', 'pytest'],
  },
]

export function OtherProjects() {
  return (
    <div className="home-project-groups">
      <section aria-labelledby="more-projects-title">
        <h2 id="more-projects-title" className="home-label">
          {l('More projects', 'Fler projekt')}
        </h2>
        <ul className="work-row">
          {REPOS.map((repo) => (
            <li key={repo.name}>
              <a
                className="work-card"
                href={`https://github.com/korv9/${repo.name}`}
                target="_blank"
                rel="noreferrer"
              >
                <h3 className="work-title">{b(repo.title)}</h3>
                <p className="work-question">{b(repo.summary)}</p>
                <p className="work-tech">{repo.tech.join(' · ')}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const STUDIES = ['philosophy-atlas', 'symbolic-atlas', 'concept-constellation']

/** The humanities studies; each card opens its page on this site. */
export function Research() {
  const studies = STUDIES.flatMap((id) => PROJECTS.filter((p) => p.id === id))
  return (
    <section
      className="home-screen home-research"
      id="research"
      aria-labelledby="research-title"
    >
      <h2 id="research-title" className="home-work-title">
        {b(RESEARCH.title)}
      </h2>
      <p className="home-flagship-text home-research-intro">
        {b(RESEARCH.text)}
      </p>
      <ul className="work-row home-research-list">
        {studies.map((p) => (
          <li key={p.id}>
            <a className="work-card" href={`#${p.id}`}>
              <h3 className="work-title">{b(p.title)}</h3>
              <p className="work-question">{b(p.summary)}</p>
              <p className="work-tech">{p.tech.join(' · ')}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
