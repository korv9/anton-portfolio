export const rolePatterns: Record<string, string> = {
  data_engineer: 'data.?engineer|dataingenjör|etl.?utvecklare',
  analytics_engineer: 'analytics.?engineer',
  python_developer: 'python.?develop|pythonutvecklare',
  ai_engineer: 'ai.?engineer|ai.?utvecklare',
  data_platform: 'data.?platform|dataplattform',
  fullstack: 'full.?stack|fullstack',
  bi_developer: 'bi.?develop|bi.?utvecklare|business intelligence',
  data_analyst: 'data.?analyst|dataanalytiker',
  ml_engineer: 'machine.?learning|maskininlärning',
}
export const skillAliases: Record<string, string> = {
  python: 'python',
  sql: 'sql',
  pyspark: 'pyspark',
  azure: 'azure',
  databricks: 'databricks',
  'delta lake': 'delta lake|delta',
  dbt: 'dbt(?: core)?',
  duckdb: 'duckdb',
  parquet: 'parquet',
  etl: 'etl|elt|etl/elt',
  'rest api': 'rest api|rest apis|restful',
  'databricks workflows': 'databricks workflows',
  'data modeling': 'data model(?:ling|ing)|datamodellering|star schema',
  git: 'git',
  'ci/cd': 'ci/cd|continuous integration',
  react: 'react',
  typescript: 'typescript',
  nlp: 'nlp|natural language processing',
  umap: 'umap',
  hdbscan: 'hdbscan',
  'sentence-transformers': 'sentence-transformers',
  mlflow: 'mlflow',
  'power bi': 'power bi',
  dax: 'dax',
  'microsoft fabric': 'microsoft fabric',
  cloudflare: 'cloudflare',
  'github actions': 'github actions',
}
export type SkillFact = {
  skill: string
  level: 'evidenced' | 'partial'
  source_ref: string
  quote: string
}
export type ExperienceFact = {
  kind: 'internship' | 'project'
  label: string
  skills: string[]
  source_ref: string
  quote: string
}
export type SearchProfile = {
  schema_version: 1
  source: { sha256: string; kind: 'candidate_supplied_cv' }
  facts: {
    skills: SkillFact[]
    experience: ExperienceFact[]
    professional_years: null | number
    education: {
      level: 'higher_vocational' | 'bachelor' | 'master' | 'doctorate'
      credits: number
      completed: string
      source_ref: string
      quote: string
    }
  }
  preferences: {
    locations: string[]
    remote: boolean
    role_weights: Record<string, number>
    weights: Record<
      | 'role'
      | 'required'
      | 'preferred'
      | 'experience'
      | 'location'
      | 'education',
      number
    >
    minimum_score: number
  }
}
export function skillKey(label: string): string {
  const normalized = label.toLocaleLowerCase().trim()
  return (
    Object.keys(skillAliases).find((k) =>
      new RegExp('^(?:' + skillAliases[k] + ')(?:,.*)?$', 'i').test(normalized),
    ) || normalized
  )
}
export function parseProfile(value: unknown): SearchProfile {
  const p = value as SearchProfile
  function check(v: unknown): asserts v {
    if (!v)
      throw new Error(
        'Local qualification profile is invalid; no personalisation is enabled.',
      )
  }
  const keys = (v: object, names: string[]) =>
    Object.keys(v).every((k) => names.includes(k))
  const text = (v: unknown, max = 2000) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max
  check(
    p?.schema_version === 1 &&
      p.source?.kind === 'candidate_supplied_cv' &&
      /^[a-f0-9]{64}$/.test(p.source.sha256),
  )
  check(
    Object.keys(p).sort().join(',') ===
      'facts,preferences,schema_version,source',
  )
  check(
    Object.keys(p.facts || {})
      .sort()
      .join(',') === 'education,experience,professional_years,skills',
  )
  check(
    keys(p.source, ['sha256', 'kind']) &&
      keys(p.preferences, [
        'locations',
        'remote',
        'role_weights',
        'weights',
        'minimum_score',
      ]),
  )
  check(
    Array.isArray(p.facts.skills) &&
      Array.isArray(p.facts.experience) &&
      p.facts.skills.length <= 100 &&
      p.facts.experience.length <= 30,
  )
  check(
    p.facts.professional_years === null ||
      (Number.isFinite(p.facts.professional_years) &&
        p.facts.professional_years >= 0),
  )
  for (const s of p.facts.skills)
    check(
      keys(s, ['skill', 'level', 'source_ref', 'quote']) &&
        typeof s.skill === 'string' &&
        ['evidenced', 'partial'].includes(s.level) &&
        text(s.source_ref, 300) &&
        text(s.quote),
    )
  for (const e of p.facts.experience)
    check(
      keys(e, ['kind', 'label', 'skills', 'source_ref', 'quote']) &&
        ['internship', 'project'].includes(e.kind) &&
        typeof e.label === 'string' &&
        Array.isArray(e.skills) &&
        e.skills.every((s) => text(s, 100)) &&
        text(e.source_ref, 300) &&
        text(e.quote),
    )
  check(
    keys(p.facts.education, [
      'level',
      'credits',
      'completed',
      'source_ref',
      'quote',
    ]),
  )
  check(
    ['higher_vocational', 'bachelor', 'master', 'doctorate'].includes(
      p.facts.education?.level,
    ) &&
      Number.isFinite(p.facts.education.credits) &&
      p.facts.education.credits >= 0 &&
      typeof p.facts.education.completed === 'string' &&
      /^\d{4}-(?:0[1-9]|1[0-2])$/.test(p.facts.education.completed) &&
      text(p.facts.education.source_ref, 300) &&
      text(p.facts.education.quote),
  )
  check(
    Array.isArray(p.preferences?.locations) &&
      p.preferences.locations.every((v) => typeof v === 'string') &&
      typeof p.preferences.remote === 'boolean',
  )
  check(
    Object.entries(p.preferences.role_weights).every(
      ([k, v]) =>
        Object.hasOwn(rolePatterns, k) &&
        Number.isFinite(v) &&
        v >= 0 &&
        v <= 1,
    ),
  )
  check(
    Object.keys(p.preferences.weights).sort().join(',') ===
      'education,experience,location,preferred,required,role',
  )
  check(
    Object.values(p.preferences.weights).every(
      (v) => Number.isFinite(v) && v >= 0,
    ) && Object.values(p.preferences.weights).reduce((a, b) => a + b, 0) > 0,
  )
  check(
    Number.isFinite(p.preferences.minimum_score) &&
      p.preferences.minimum_score >= 0 &&
      p.preferences.minimum_score <= 100,
  )
  const serialized = JSON.stringify(p)
  check(
    serialized.length <= 40000 &&
      !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+46|\b0[1-9])(?:[ -]?\d){7,10}\b/.test(
        serialized,
      ),
  )
  return p
}
