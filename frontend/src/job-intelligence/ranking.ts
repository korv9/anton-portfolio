import type { Job } from '../companies/model.ts'
import type { JobDetail, Requirement } from './model.ts'
import {
  rolePatterns,
  skillKey,
  type SearchProfile,
  type SkillFact,
} from './profile.ts'

export type RequirementMatch = {
  requirement: Requirement
  state: 'matched' | 'partial' | 'not_evidenced'
  evidence: SkillFact | null
}
export type Relevance = {
  job_id: string
  score: number
  suitable: boolean
  blockers: { reason: string; quote: string }[]
  requirements: RequirementMatch[]
  factors: {
    key: string
    value: number | null
    weight: number
    explanation: string
  }[]
  role: string | null
  version: 'relevance-v1'
}
const skillCategories = [
  'language',
  'database',
  'framework',
  'cloud',
  'platform',
  'practice',
  'structured_skill',
]
const numberWords: Record<string, number> = {
  ett: 1,
  två: 2,
  tre: 3,
  fyra: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  åtta: 8,
  nio: 9,
  tio: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}
export function rankJob(
  job: Job,
  detail: JobDetail,
  profile: SearchProfile,
): Relevance {
  const source = detail.description_text
  const facts = new Map(profile.facts.skills.map((s) => [skillKey(s.skill), s]))
  const dedup = new Map<string, Requirement>()
  for (const r of detail.analysis.requirements) {
    if (skillCategories.includes(r.category) && r.strength !== 'ambiguous')
      dedup.set(skillKey(r.label) + '/' + r.strength, r)
  }
  const requirements: RequirementMatch[] = [...dedup.values()].map((r) => {
    const evidence = facts.get(skillKey(r.label)) || null
    return {
      requirement: r,
      state:
        evidence?.level === 'evidenced'
          ? 'matched'
          : evidence
            ? 'partial'
            : 'not_evidenced',
      evidence,
    }
  })
  const coverage = (level: 'required' | 'preferred') => {
    const rows = requirements.filter((r) => r.requirement.strength === level)
    return rows.length
      ? rows.reduce(
          (n, r) =>
            n + (r.state === 'matched' ? 1 : r.state === 'partial' ? 0.5 : 0),
          0,
        ) / rows.length
      : null
  }
  const blockers: { reason: string; quote: string }[] = []
  for (const r of requirements.filter(
    (r) => r.requirement.strength === 'required' && r.state === 'not_evidenced',
  ))
    blockers.push({
      reason: `Required ${r.requirement.label} is not evidenced in the CV; verify before applying.`,
      quote: r.requirement.quote,
    })
  const title = job.title.toLocaleLowerCase()
  const roles = Object.entries(rolePatterns)
    .filter(([, pattern]) => new RegExp(pattern, 'i').test(title))
    .map(([key]) => ({
      key,
      value: profile.preferences.role_weights[key] || 0,
    }))
    .sort((a, b) => b.value - a.value)
  const role = roles[0]?.key || null
  let roleValue = roles[0]?.value || 0
  if (
    !role &&
    /data|python|analytics|analys|etl|business intelligence/i.test(
      title + ' ' + source.slice(0, 800),
    )
  )
    roleValue = 0.4
  const seniorTitle =
    /\b(senior|lead|staff|principal|chef|head of|manager)\b/i.test(job.title)
  const narrowRole =
    /\bdba\b|database administrator|databasadministratör/i.test(job.title) ||
    (/\bdevops\b|infrastructure engineer/i.test(job.title) &&
      !roles.some((r) =>
        ['data_engineer', 'data_platform', 'analytics_engineer'].includes(
          r.key,
        ),
      ))
  let experience = seniorTitle ? 0.15 : 0.75
  let hardExperience = false,
    hardEducation = false,
    experienceConflict = false,
    educationAlternative = false
  for (const r of detail.analysis.requirements.filter(
    (r) => r.strength === 'required',
  )) {
    const years = r.quote.match(
      /\b(\d+|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio|one|two|three|four|five|six|seven|eight|nine|ten)\+?\s*(?:års?|years?|yrs?)/i,
    )
    const range = r.quote.match(/\b(\d+)\s*[-–]\s*\d+\s*(?:års?|years?|yrs?)/i)
    const minimum = range
      ? Number(range[1])
      : years
        ? Number(years[1]) || numberWords[years[1].toLocaleLowerCase()]
        : null
    if (
      r.category === 'experience' &&
      minimum &&
      (profile.facts.professional_years === null ||
        profile.facts.professional_years < minimum)
    ) {
      experienceConflict = true
      hardExperience = hardExperience || minimum >= 3
      experience = hardExperience ? 0 : 0.35
      blockers.push({
        reason: `CV does not establish ${minimum} years of professional experience. Internships and projects are kept separate.`,
        quote: r.quote,
      })
    }
    if (
      r.category === 'education' &&
      /ph\.?d|doktorsexamen|bachelor|kandidat(?:examen)?|master|civilingenjör|universitet|högskol|university/i.test(
        r.quote,
      ) &&
      profile.facts.education.level === 'higher_vocational'
    ) {
      const alternative =
        /or equivalent|eller.*(?:motsvarande|likvärdig)/i.test(r.quote)
      educationAlternative ||= alternative
      hardEducation ||= !alternative
      blockers.push({
        reason:
          'The specified university degree is not established by the documented YH qualification; check accepted alternatives.',
        quote: r.quote,
      })
    }
    if (
      /personalansvar|people management|manage a team|ledarerfarenhet/i.test(
        r.quote,
      )
    ) {
      hardExperience = true
      experience = 0
      blockers.push({
        reason:
          'The requested management experience is not established by the CV.',
        quote: r.quote,
      })
    }
    if (
      r.category === 'conditions' &&
      /medborgarskap|citizenship|säkerhetsprövning|security clearance|svenska.*(?:tal|skrift)|swedish.*(?:fluent|proficien)/i.test(
        r.quote,
      )
    )
      blockers.push({
        reason:
          'The citizenship, security or language condition needs verification; it is not established by the configured CV facts.',
        quote: r.quote,
      })
  }
  const explicitJunior =
    /\bjunior\b|nyexaminerad|graduate|trainee/i.test(job.title) ||
    detail.analysis.requirements.some(
      (r) => r.category === 'seniority' && /junior/i.test(r.label),
    )
  if (explicitJunior && !experienceConflict && !hardExperience) experience = 1
  const location = job.location?.toLocaleLowerCase() || ''
  const preferredLocation = profile.preferences.locations.find((l) =>
    location.includes(l.toLocaleLowerCase()),
  )
  const remote =
    profile.preferences.remote &&
    detail.remote_evidence.some(
      (q) =>
        /remote|distans|hybrid/i.test(q) &&
        !/\b(?:inte|ej|ingen|inget|not|no)\b|on.?site only/i.test(q),
    )
  const locationValue = preferredLocation
    ? profile.preferences.locations.indexOf(preferredLocation) === 0
      ? 1
      : 0.85
    : remote
      ? 0.8
      : location
        ? 0.35
        : 0.5
  const educationRows = detail.analysis.requirements.filter(
    (r) => r.category === 'education' && r.strength === 'required',
  )
  const education = hardEducation
    ? 0
    : educationAlternative
      ? 0.5
      : educationRows.length
        ? 1
        : null
  const values = {
    role: roleValue,
    required: coverage('required'),
    preferred: coverage('preferred'),
    experience,
    location: locationValue,
    education,
  }
  const explanations = {
    role: role
      ? `Title matches configured ${role.replaceAll('_', ' ')} preference.`
      : 'No direct target-role title match.',
    required:
      'Evidenced explicit requirements; partial evidence counts half. Unobserved skills are not asserted absent.',
    preferred:
      'Evidenced preferred requirements; missing advertised criteria are unassessed.',
    experience: hardExperience
      ? 'Explicit experience requirement needs verification.'
      : seniorTitle
        ? 'Senior title lowers priority; source requirements remain visible.'
        : 'Junior-compatible signal or unspecified seniority; no years invented.',
    location: preferredLocation
      ? `Advertised location matches preference ${preferredLocation}.`
      : remote
        ? 'Advertisement mentions remote/hybrid arrangements; verify attendance conditions.'
        : 'Location is outside preferences or unspecified; the job is not silently excluded.',
    education: hardEducation
      ? 'YH is not equated with a university degree.'
      : educationAlternative
        ? 'The source accepts alternatives; equivalence of the documented YH and practical experience needs verification.'
        : educationRows.length
          ? 'No documented degree-level conflict detected.'
          : 'No explicit education requirement assessed.',
  }
  const factors = Object.entries(values).map(([key, value]) => ({
    key,
    value,
    weight: profile.preferences.weights[key as keyof typeof values],
    explanation: explanations[key as keyof typeof values],
  }))
  const denominator = factors.reduce(
    (s, f) => s + (f.value === null ? 0 : f.weight),
    0,
  )
  let score = denominator
    ? Math.round(
        (100 *
          factors.reduce(
            (s, f) => s + (f.value === null ? 0 : f.value * f.weight),
            0,
          )) /
          denominator,
      )
    : 0
  if (seniorTitle || narrowRole) score = Math.min(score, 49)
  if (hardExperience || hardEducation) score = Math.min(score, 39)
  return {
    job_id: job.job_id,
    score,
    suitable:
      roleValue >= 0.5 &&
      score >= profile.preferences.minimum_score &&
      !hardExperience &&
      !hardEducation,
    blockers,
    requirements,
    factors,
    role,
    version: 'relevance-v1',
  }
}
export function rankCandidates(
  jobs: Job[],
  details: JobDetail[],
  profile: SearchProfile,
) {
  const docs = new Map(details.map((d) => [d.job_id, d]))
  return jobs
    .filter((j) => docs.has(j.job_id))
    .map((j) => rankJob(j, docs.get(j.job_id)!, profile))
    .sort(
      (a, b) =>
        Number(b.suitable) - Number(a.suitable) ||
        Number(a.blockers.length > 0) - Number(b.blockers.length > 0) ||
        b.score - a.score ||
        (a.job_id < b.job_id ? -1 : 1),
    )
}
