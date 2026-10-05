/**
 * The eclipse radar's axes: each headline skill, and where it is used. An axis is as long as
 * its evidence: one for the skill itself, plus one for every job and project whose tools or
 * description name it. Nothing is rated; everything counted is in orbitContent.ts.
 */
export type Evidence = { name: string; text: string }

export type Axis = {
  skill: string
  group: string
  /** The jobs and projects that use the skill. */
  uses: string[]
  /** 1 (the skill) + the number of uses. */
  value: number
}

/** Other words a skill goes by in the job and project texts. */
const ALIASES: Record<string, string[]> = {
  'dbt Core': ['dbt'],
  Databricks: ['databricks'],
  'Semantiska modeller': ['semantiska modeller', 'semantic models'],
  Klustring: ['klustring', 'clustering'],
  'sentence-transformers': ['sentence-transformers', 'embeddings'],
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function matches(skill: string, text: string) {
  const words = ALIASES[skill] ?? [skill]
  return words.some((w) =>
    new RegExp(
      `(^|[^\\p{L}\\p{N}-])${escape(w)}($|[^\\p{L}\\p{N}-])`,
      'iu',
    ).test(text),
  )
}

export function skillAxes(
  groups: { group: string; skills: string[] }[],
  evidence: Evidence[],
): Axis[] {
  return groups.flatMap(({ group, skills }) =>
    skills.map((skill) => {
      const uses = evidence
        .filter((e) => matches(skill, e.text))
        .map((e) => e.name)
      return { skill, group, uses, value: 1 + uses.length }
    }),
  )
}
