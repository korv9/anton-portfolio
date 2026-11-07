/**
 * The skills the CV lacks, counted over the good, possible and stretch matches: a gap is a named,
 * unambiguous skill shown neither in work nor in education or a project (platform/job_assistant
 * match.py, `gaps`). `only` counts the ads where it is the single gap,
 * `listed` how many of the ads are good or possible matches.
 */
import type { Match, MatchClass } from './model'

const COUNTED: MatchClass[] = ['strong', 'possible', 'stretch']

type Gap = { skill: string; ads: number; only: number; listed: number }

export function skillGaps(matches: Match[], limit = 10): Gap[] {
  const out = new Map<string, Gap>()
  for (const m of matches) {
    if (!COUNTED.includes(m.class) || !m.gaps?.length) continue
    for (const skill of new Set(m.gaps)) {
      const g = out.get(skill) ?? { skill, ads: 0, only: 0, listed: 0 }
      g.ads += 1
      if (m.gaps.length === 1) g.only += 1
      if (m.class !== 'stretch') g.listed += 1
      out.set(skill, g)
    }
  }
  return [...out.values()]
    .sort(
      (a, b) =>
        b.only - a.only || b.ads - a.ads || a.skill.localeCompare(b.skill),
    )
    .slice(0, limit)
}
