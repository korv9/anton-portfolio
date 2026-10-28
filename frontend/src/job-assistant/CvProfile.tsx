/**
 * The approved competence profile, public by the owner's choice: each skill under its strongest
 * CV level, with the CV line behind it and the CV entry it comes from. Only the approved version
 * from /api/jobs/profile is read here; the draft, the CV file, the summary (name, contact
 * lines), notes and statuses are never shown.
 */
import { useEffect, useState } from 'react'
import { l } from '../i18n'
import type { Quote, Source } from './model'
import { cvLevelLabel, cvSection, day, sourceLabel } from './labels'

type Entry = {
  id: string
  kind?: string
  title?: string
  organisation?: string
  name?: string
  programme?: string
  institution?: string
}
export type ApprovedProfile = {
  version: number
  approved_at?: string
  wishes: { locations: string[]; remote: string | null; roles: string[] }
  skills: { skill: string; level: string; evidence?: Quote[] }[]
  experience?: Entry[]
  projects?: Entry[]
  education?: Entry[]
}

/** The approved profile, null when none is approved, 'failed' when the route could not be read. */
export function useApprovedProfile() {
  const [profile, setProfile] = useState<
    ApprovedProfile | null | 'failed' | undefined
  >()
  useEffect(() => {
    fetch('/api/jobs/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => setProfile(p?.approved ?? null))
      .catch(() => setProfile('failed'))
  }, [])
  return profile
}

const GROUPS = ['practical', 'education_or_project', 'listed'] as const

/** The quote's source, else the kind of the CV entry its ref names (older files have no source). */
function sourceOf(q: Quote, entry?: Entry): Source | undefined {
  if (q.source) return q.source
  const key = q.ref?.replace(/-\d+$/, '')
  if (key === 'experience' || key === 'other')
    return entry?.kind === 'internship' ? 'internship' : 'employment'
  if (key === 'project') return 'project'
  if (key === 'education') return 'education'
  if (key === 'skills') return 'skills_list'
  if (key === 'summary') return 'summary'
  return undefined
}

const entryName = (e?: Entry) =>
  e &&
  [e.title ?? e.name ?? e.programme, e.organisation ?? e.institution]
    .filter(Boolean)
    .join(', ')

export default function CvProfile({ profile }: { profile: ApprovedProfile }) {
  const entries = new Map(
    [
      ...(profile.experience ?? []),
      ...(profile.projects ?? []),
      ...(profile.education ?? []),
    ].map((e) => [e.id, e]),
  )
  return (
    <section className="ja-wide" aria-labelledby="ja-cv-profile">
      <h2 id="ja-cv-profile">
        {l('The approved CV profile', 'Den godkända cv-profilen')}
      </h2>
      <p className="ja-muted">
        {l(
          `Version ${profile.version}, approved ${day(profile.approved_at)}. Each skill sits under the strongest level the CV shows, with the line it rests on. This is what every ad is matched against.`,
          `Version ${profile.version}, godkänd ${day(profile.approved_at)}. Varje kompetens står under den starkaste nivån cv:t visar, med raden den bygger på. Det är mot den här varje annons matchas.`,
        )}
      </p>
      {GROUPS.map((level) => {
        const skills = profile.skills.filter((s) => s.level === level)
        if (skills.length === 0) return null
        return (
          <div key={level} className="ja-table-wrap">
            <table className="ja-table ja-cv-skills">
              <caption>
                {cvLevelLabel(level)} ({skills.length})
              </caption>
              <thead>
                <tr>
                  <th scope="col">{l('Skill', 'Kompetens')}</th>
                  <th scope="col">{l('The CV', 'Cv:t')}</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => {
                  const q =
                    s.evidence?.find((e) => e.level === level) ??
                    s.evidence?.[0]
                  const entry = q?.ref ? entries.get(q.ref) : undefined
                  const from = [
                    sourceLabel(q && sourceOf(q, entry)),
                    entryName(entry) || (q?.ref && cvSection(q.ref)),
                  ].filter(Boolean)
                  return (
                    <tr key={s.skill}>
                      <th scope="row">{s.skill}</th>
                      <td>
                        {q && <q>{q.quote}</q>}
                        {from.length > 0 && (
                          <small className="ja-ref">{from.join(' · ')}</small>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
}
