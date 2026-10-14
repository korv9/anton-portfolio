import { l } from '../i18n'
import { ChartCard, DashGrid } from '../ui/dash/Dash'
import TechCard from '../ui/dash/TechCard'
import { PROJECTS } from './projectRegistry'

const MODELS: Record<
  string,
  { fact: string; dims: string[]; marts: string[]; source: [string, string] }
> = {
  jobs: {
    fact: 'stg_market_ads',
    dims: ['dim_market_field', 'dim_market_occupation_group'],
    marts: ['mart_market_field_monthly', 'mart_market_occupation_yearly'],
    source: ['JobTech historical archives', 'JobTechs historiska arkiv'],
  },
  welfare: {
    fact: 'fct_indicator',
    dims: ['dim_indicator', 'dim_region', 'dim_period'],
    marts: ['mart_county_year_overview'],
    source: [
      'SCB, Försäkringskassan, the Public Health Agency, ESS, Kolada',
      'SCB, Försäkringskassan, Folkhälsomyndigheten, ESS, Kolada',
    ],
  },
  'ai-act': {
    fact: 'dim_ai_act_article',
    dims: ['dim_ai_act_actor', 'dim_ai_act_document'],
    marts: [
      'mart_ai_act_obligations',
      'mart_ai_act_timeline',
      'mart_ai_act_changes',
    ],
    source: [
      'EU Publications Office, official texts in English and Swedish',
      'EU:s publikationsbyrå, officiell text på engelska och svenska',
    ],
  },
  'symbolic-atlas': {
    fact: 'mart_symbol_atlas',
    dims: [],
    marts: ['mart_symbol_profiles'],
    source: [
      'Public-domain books from Project Gutenberg',
      'Fria böcker från Project Gutenberg',
    ],
  },
  'philosophy-atlas': {
    fact: 'mart_philosophy_atlas',
    dims: ['dim_philosophy_document', 'dim_tension'],
    marts: ['mart_philosophy_clusters', 'mart_philosophy_tensions'],
    source: ['Public-domain philosophical works', 'Fria filosofiska verk'],
  },
  'concept-constellation': {
    fact: 'fact_concept_alignment',
    dims: ['dim_concept', 'dim_corpus', 'dim_text_chunk'],
    marts: [
      'mart_concept_profiles',
      'mart_concept_relations',
      'mart_concept_passages',
    ],
    source: [
      'Myth, philosophy, Riksdag speeches and the AI Act',
      'Myter, filosofi, riksdagstal och AI-förordningen',
    ],
  },
  politics: {
    fact: 'fct_party_roll_call',
    dims: ['dim_parliament_session', 'dim_issue'],
    marts: ['mart_party_session_record', 'mart_party_pair_session'],
    source: [
      'The Riksdag: speeches, replies and committee reports',
      'Riksdagen: anföranden, repliker och utskottsbetänkanden',
    ],
  },
}

export default function ProjectTech({
  project,
  span = 12,
  debates = false,
}: {
  project: string
  span?: number
  debates?: boolean
}) {
  const entry = PROJECTS.find((p) => p.id === project)!
  const path = window.location.hash.split('?')[0]
  const model =
    project === 'politics' && /budget/.test(path)
      ? {
          fact: 'stg_budget_frame',
          dims: [],
          marts: ['mart_budget_context'],
          source: [
            'Riksdag budget reports',
            'Riksdagens budgetbetänkanden',
          ] as [string, string],
        }
      : project === 'politics' && /valjarna/.test(path)
        ? {
            fact: 'fct_party_poll',
            dims: [],
            marts: [],
            source: [
              'SCB party preference survey',
              'SCB:s partisympatiundersökning',
            ] as [string, string],
          }
        : project === 'politics' && /skatter/.test(path)
          ? {
              fact: 'fct_tax_revenue',
              dims: ['dim_tax_country', 'dim_tax_type'],
              marts: [],
              source: [
                'OECD Revenue Statistics',
                'OECD Revenue Statistics',
              ] as [string, string],
            }
          : project === 'politics' &&
              /debatt|tal|sok|utredningar|nyheter/.test(path)
            ? undefined
            : MODELS[project]
  const built =
    project === 'symbolic-atlas'
      ? l(
          'Symbol words in context, sentence embeddings, UMAP and HDBSCAN in dbt and DuckDB, with experiments separating symbolic structure from book identity.',
          'Symbolord i sitt sammanhang, meningsinbäddningar, UMAP och HDBSCAN i dbt och DuckDB, med experiment som skiljer symbolisk struktur från bokidentitet.',
        )
      : l(entry.built.en, entry.built.sv)
  const card = model ? (
    <TechCard
      span={span}
      fact={model.fact}
      dims={model.dims}
      marts={model.marts}
      sub={l(entry.descriptor.en, entry.descriptor.sv)}
      steps={[
        { title: l('Sources', 'Källor'), detail: l(...model.source) },
        {
          title: l('Transformation and checks', 'Bearbetning och kontroller'),
          detail: debates
            ? l(
                'politics/parliament/sakdebatter.json: shares of utterances per issue area, filtered by party and period; words are compared per 10,000 words.',
                'politics/parliament/sakdebatter.json: andelar yttranden per sakområde, filtrerade på parti och period; ord jämförs per 10 000 ord.',
              )
            : built,
        },
        {
          title: l('Published output', 'Publicerat resultat'),
          detail: l(entry.result.en, entry.result.sv),
        },
      ]}
      runs={entry.tech.join(' · ')}
    />
  ) : (
    <ChartCard
      span={span}
      title={l('How it is built', 'Så är det byggt')}
      sub={l(entry.descriptor.en, entry.descriptor.sv)}
      className="dk-tech"
    >
      <p>{l(entry.built.en, entry.built.sv)}</p>
      <dl className="project-tech-facts">
        <div>
          <dt>{l('Tools', 'Verktyg')}</dt>
          <dd>{entry.tech.join(' · ')}</dd>
        </div>
        <div>
          <dt>{l('Validation and status', 'Validering och status')}</dt>
          <dd>{l(entry.result.en, entry.result.sv)}</dd>
        </div>
      </dl>
    </ChartCard>
  )
  return (
    <details className="project-method">
      <summary>
        {l('Technical method and data', 'Teknisk metod och data')}
      </summary>
      <DashGrid>{card}</DashGrid>
    </details>
  )
}
