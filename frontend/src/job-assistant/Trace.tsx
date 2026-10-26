/**
 * Where an ad's match comes from, one disclosure away: the published files, the dbt layers and
 * the checks behind them, each linked to its source. The feed's Trace (meaning/Trace.tsx) reads
 * feed-provenance.json, which has no job-assistant entry, so this lists the repository paths.
 */
import { l } from '../i18n'

const REPO = 'https://github.com/korv9/anton-portfolio/blob/main/'
const STEPS: { what: [string, string]; paths: string[] }[] = [
  {
    what: ['Published files', 'Publicerade filer'],
    paths: [
      'platform/job_assistant/export.py',
      'platform/job_assistant/export_matches.py',
    ],
  },
  {
    what: ['Gold marts, with contracts', 'Guldmodeller, med kontrakt'],
    paths: ['platform/models/gold/job_assistant/schema.yml'],
  },
  {
    what: ['Evidence and checks (silver)', 'Belägg och kontroller (silver)'],
    paths: ['platform/models/silver/job_assistant/schema.yml'],
  },
  {
    what: [
      'Ads, matches and runs (bronze)',
      'Annonser, matchningar och körningar (brons)',
    ],
    paths: ['platform/models/bronze/job_assistant/sources.yml'],
  },
  {
    what: ['Matching rules and CV parsing', 'Matchningsregler och cv-tolkning'],
    paths: ['platform/job_assistant/match.py', 'platform/job_assistant/cv.py'],
  },
  {
    what: ['Tests', 'Tester'],
    paths: [
      'platform/tests/job_assistant',
      'frontend/tests/unit/job-assistant.test.ts',
    ],
  },
  {
    what: ['The scheduled run', 'Den schemalagda körningen'],
    paths: ['.github/workflows/refresh-job-assistant.yml'],
  },
]

export default function Trace() {
  return (
    <details className="ja-trace">
      <summary>
        {l(
          'Trace: files, models and tests behind this match',
          'Spåra: filer, modeller och tester bakom matchningen',
        )}
      </summary>
      <p className="ja-muted">
        {l(
          'JobTech ad (CC0) → raw store in R2 → bronze → silver → gold → job-assistant/*.json, checked before release.',
          'JobTech-annons (CC0) → råfiler i R2 → brons → silver → guld → job-assistant/*.json, kontrollerat före release.',
        )}
      </p>
      <dl>
        {STEPS.map((s) => (
          <div key={s.paths[0]}>
            <dt>{l(...s.what)}</dt>
            <dd>
              {s.paths.map((p) => (
                <a key={p} href={REPO + p} target="_blank" rel="noreferrer">
                  <code>{p}</code>
                </a>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
