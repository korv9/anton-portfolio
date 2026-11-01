/**
 * Overview (#projects): the platform behind the projects in a few words, how it is built and
 * why, with four numbers read from its own published files. The index on the left lists the
 * projects. Older hub addresses (#projects-jobs, #platform-health, #tech-er) land here.
 */
import { l } from '../i18n'
import PageHead from '../ui/PageHead'
import type { Quality, Summary } from './overviewTypes'
import { ok, useJson as useFile } from '../useJson'
import { GROUPS } from '../site/ProjectRail'
import './hub.css'

const docs = (path: string) =>
  `https://github.com/korv9/anton-portfolio/blob/main/docs/${path}`
/** The platform written up on GitHub: the case study and the two postmortems. */
const WRITE_UPS = [
  {
    href: docs('case-studies/platform.md'),
    en: 'Case study: the data platform',
    sv: 'Fallstudie: dataplattformen',
  },
  {
    href: docs('incidents/2026-10-22-warehouse-wipe.md'),
    en: 'Postmortem: shared warehouse emptied by a worktree removal',
    sv: 'Postmortem: delat lager tömt när en worktree togs bort',
  },
  {
    href: docs('incidents/2026-10-22-third-party-text-in-r2.md'),
    en: 'Postmortem: third-party text pushed to the public R2 bucket',
    sv: 'Postmortem: tredjepartstext i den publika R2-hinken',
  },
]

export default function ProjectsHub() {
  const summary = useFile<Summary>('schema/summary.json')
  const quality = useFile<Quality>('quality/summary.json')
  const statuses = ok(quality) ? quality.run.check_statuses : undefined
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
      label: l(
        'quality checks passing, of those applicable and measured',
        'kvalitetskontroller godkända, av dem som gäller och är mätta',
      ),
      value: !ok(quality)
        ? '…'
        : statuses
          ? `${statuses.pass ?? 0} ${l('of', 'av')} ${quality.run.checks - (statuses.not_applicable ?? 0) - (statuses.not_measured ?? 0)}`
          : '–',
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
      <section className="hub-links" aria-labelledby="hub-write-ups">
        <h2 id="hub-write-ups">{l('Written up', 'Nedskrivet')}</h2>
        <ul>
          {WRITE_UPS.map((doc) => (
            <li key={doc.href}>
              <a href={doc.href} target="_blank" rel="noreferrer">
                {l(doc.en, doc.sv)} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>
      {/* On phones the index is a closed drawer, so the projects are listed here as well. */}
      <nav className="hub-index" aria-label={l('Projects', 'Projekt')}>
        {GROUPS.map((group) => (
          <section key={group.en} className="hub-links">
            <h2>{l(group.en, group.sv)}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    {...(item.external
                      ? { target: '_blank', rel: 'noreferrer' }
                      : {})}
                  >
                    {l(item.en, item.sv)}
                    {item.external && ' ↗'}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </article>
  )
}
