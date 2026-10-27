/**
 * Overview (#projects): the platform behind the projects in a few words, how it is built and
 * why, with four numbers read from its own published files. The index on the left lists the
 * projects. Older hub addresses (#projects-jobs, #platform-health, #tech-er) land here.
 */
import { l } from '../i18n'
import PageHead from '../ui/PageHead'
import type { Summary } from './Headline'
import type { Quality } from '../tech/WarehouseTables'
import { ok, useFile } from '../tech/techData'
import './hub.css'

export default function ProjectsHub() {
  const summary = useFile<Summary>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const kpis = [
    {
      label: l('warehouse rows', 'rader i lagret'),
      value: ok(summary) ? `${(summary.rows / 1e6).toFixed(1)}M` : '…',
    },
    {
      label: l('dbt models', 'dbt-modeller'),
      value: ok(summary) ? summary.models : '…',
    },
    {
      label: l('dbt tests', 'dbt-tester'),
      value: ok(summary) ? summary.tests : '…',
    },
    {
      label: l('quality checks passing', 'kvalitetskontroller godkända'),
      value: ok(quality)
        ? `${quality.run.check_statuses?.pass ?? '–'}/${quality.run.checks}`
        : '…',
    },
  ]
  return (
    <article className="hub-overview" id="projects">
      <PageHead
        title={l('Overview', 'Översikt')}
        sentence={l(
          'One data platform of my own runs every project here.',
          'En egen dataplattform driver alla projekt här.',
        )}
        kpis={kpis}
      />
      <dl className="hub-why">
        <div>
          <dt>{l('How', 'Hur')}</dt>
          <dd>
            {l(
              'Python fetches public data from Swedish agencies and the EU on a schedule. dbt on DuckDB cleans it in three layers, tests stop a bad run, and each project reads its own published files.',
              'Python hämtar öppna data från svenska myndigheter och EU enligt schema. dbt på DuckDB rensar dem i tre lager, tester stoppar en dålig körning, och varje projekt läser sina egna publicerade filer.',
            )}
          </dd>
        </div>
        <div>
          <dt>{l('Why', 'Varför')}</dt>
          <dd>
            {l(
              'To read as many public sources as I could in one place, and see what they say together.',
              'För att läsa in så många öppna källor som möjligt på ett ställe och se vad de säger tillsammans.',
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}
