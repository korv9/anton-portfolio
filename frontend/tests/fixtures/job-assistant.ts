/**
 * Synthetic job-assistant files for the #jobs spec: invented ads and matches in the shape of
 * platform/job_assistant/export.py, dated relative to the test run. Never published.
 */
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * 86_400_000)
  return d.toISOString().slice(0, 10)
}
const PLACES = ['Stockholm', 'Solna', 'Göteborg', 'Malmö']
const TITLES = [
  'Data Engineer',
  'Analytics Engineer',
  'Python-utvecklare',
  'BI-utvecklare',
  'ML Engineer',
  'Dataanalytiker',
]
const CLASSES = ['strong', 'possible', 'possible', 'stretch', 'outside'] as const

export function jobAssistantFixture() {
  const ads = Array.from({ length: 30 }, (_, i) => ({
    id: String(1000 + i),
    headline: `${TITLES[i % TITLES.length]} ${i + 1}`,
    employer: `Testbolag ${String.fromCharCode(65 + (i % 6))} AB`,
    organisation_number: null,
    municipality: PLACES[i % PLACES.length],
    region: 'Testlän',
    occupation: 'Mjukvaru- och systemutvecklare m.fl.',
    employment_type: i % 3 ? 'Vanlig anställning' : 'Behovsanställning',
    working_hours: 'Heltid',
    published: `${day(-(i % 9))}T08:00:00`,
    changed: null,
    first_seen: `${day(-(i % 9))}T08:05:00+00:00`,
    application_deadline: i % 4 ? `${day(3 + i)}T23:59:59` : null,
    removed_at: null,
    duplicate_of: null,
    source_url: `https://arbetsformedlingen.se/platsbanken/annonser/${1000 + i}`,
    application_url: null,
    content_hash: 'x',
    expired: false,
  }))
  const matches = ads.map((a, i) => ({
    id: a.id,
    rank: i + 1,
    class: CLASSES[i % CLASSES.length],
    role: i % 2 ? 'analytics_engineering' : 'data_engineering',
    role_from_title: true,
    reasons: ['A wished role in the title.'],
    similarity: null,
    sample: i % 10 === 4,
    detailed: true,
    gaps: i % 2 ? ['Kubernetes'] : [],
    uncertain: [],
    remote: i % 5 === 0 ? 'Distansarbete är möjligt.' : null,
    seniority: { title: null, years: null, junior: i % 3 ? null : 'junior' },
    explanation: null,
    explanation_model: null,
    skills: [
      {
        skill: i % 2 ? 'dbt' : 'python',
        strength: 'required',
        cv_level: 'practical',
        ad_quotes: [{ quote: 'Du har arbetat med dbt.', line: 1, field: 'description' }],
        cv_quotes: [
          {
            quote: 'Built dbt models.',
            ref: 'experience-1',
            level: 'practical',
            source: 'internship',
          },
        ],
      },
      {
        skill: 'kubernetes',
        strength: 'preferred',
        cv_level: null,
        ad_quotes: [{ quote: 'Meriterande med Kubernetes.', line: 2, field: 'description' }],
        cv_quotes: [],
      },
    ],
    checks: [],
  }))
  const head = { schema_version: 1, generated_at: new Date().toISOString() }
  return {
    ads: {
      ...head,
      fetched_until: head.generated_at,
      counts: { current: ads.length, removed: 0, duplicates: 0 },
      runs: [{ day: day(0), runs: 10, runs_ok: 10, runs_failed: 0 }],
      ads,
    },
    matches: {
      ...head,
      profile: {
        profile_version: 1,
        cv_sha256: 'e'.repeat(64),
        approved_at: head.generated_at,
        matched_at: head.generated_at,
        neurons_after: null,
      },
      matches,
    },
    texts: {
      ...head,
      texts: Object.fromEntries(
        ads.map((a) => [
          a.id,
          {
            description:
              'Vi söker en dataingenjör.\n\nDu har arbetat med dbt.\nMeriterande med Kubernetes.',
            contact_redactions: 0,
          },
        ]),
      ),
    },
    // The ads without a text in texts.json, loaded when one of them is opened.
    'texts-remaining': {
      ...head,
      texts: {} as Record<
        string,
        { description: string; contact_redactions: number }
      >,
    },
    demand: { ...head, profile: null, skills: [] },
    reviews: {
      reviews: {
        '1000': { status: 'applied', note: '', updated_at: head.generated_at },
        '1001': { status: 'interesting', note: '', updated_at: head.generated_at },
      },
    },
    // GET /api/jobs/profile as a visitor gets it: the approved version, never the draft.
    profile: {
      draft: null,
      approved: {
        version: 1,
        approved_at: head.generated_at,
        wishes: { roles: ['data_engineering'], locations: ['Solna'], remote: null, interests: [] },
        skills: [
          {
            skill: 'dbt',
            level: 'practical',
            evidence: [{ level: 'practical', ref: 'experience-1', quote: 'Built dbt models.' }],
          },
          {
            skill: 'python',
            level: 'education_or_project',
            evidence: [{ level: 'education_or_project', ref: 'project-1', quote: 'Wrote a Python CLI.' }],
          },
        ],
        experience: [{ id: 'experience-1', kind: 'internship', title: 'Data Engineer', organisation: 'Testbolag A AB' }],
        projects: [{ id: 'project-1', name: 'Test project' }],
        education: [],
      },
      versions: [],
    },
  }
}
