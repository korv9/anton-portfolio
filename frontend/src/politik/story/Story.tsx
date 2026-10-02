/**
 * Svensk politik genom data: the politics product's front page, one vertical story in nine
 * sections. Sweden now, power, decisions, the dividing lines, the parties, the debates, the
 * members, advanced analysis, and how it is built. Each section asks one question, answers it
 * with a chart and a sentence generated from the data, and links to the pages that go deeper.
 * The party, debate and member chosen are kept in the address, so a view can be shared.
 */
import { useEffect, useState } from 'react'
import { l } from '../../i18n'
import { load, type Now } from '../../parliament/data'
import type { Route } from '../../router'
import { RIKSDAG_PARTIES, partyName } from '../../parties/identity'
import { useViewParams } from '../useViewParams'
import { dayName, num, pct } from '../controls'
import { useStory, useVoteAnalytics } from '../analytics/load'
import { Info, Kpi } from './parts'
import Makten from './Makten'
import Besluten from './Besluten'
import Skiljelinjerna from './Skiljelinjerna'
import Partierna from './Partierna'
import Debatterna from './Debatterna'
import Ledamoterna from './Ledamoterna'
import Advanced from './Advanced'
import OmDatan from './OmDatan'
import './story.css'

const DEFAULTS = { parti: 'S', debatt: '', ledamot: '' }

const TOC: [string, string, string][] = [
  ['nu', 'Sweden now', 'Sverige just nu'],
  ['makten', 'Power', 'Makten'],
  ['besluten', 'Decisions', 'Besluten'],
  ['skiljelinjerna', 'Dividing lines', 'Skiljelinjerna'],
  ['partierna', 'The parties', 'Partierna'],
  ['debatterna', 'The debates', 'Debatterna'],
  ['ledamoterna', 'The members', 'Ledamöterna'],
  ['fordjupad', 'Advanced', 'Fördjupad analys'],
  ['om-datan', 'About the data', 'Om datan'],
]

export default function Story({ route }: { route: Route }) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const [now, setNow] = useState<Now | null>(null)
  const [nowError, setNowError] = useState<string | null>(null)
  const { analytics: a, quality, error } = useVoteAnalytics()
  const { story, error: storyError } = useStory()
  useEffect(() => {
    load<Now>('parliament/now.json')
      .then(setNow)
      .catch((e: Error) => setNowError(e.message))
  }, [])
  const failed = error ?? nowError ?? storyError
  const party = RIKSDAG_PARTIES.includes(view.parti) ? view.parti : 'S'
  const meanCohesion = a
    ? a.cohesion.reduce((s, c) => s + c.pct, 0) / a.cohesion.length
    : null
  const latestDebate = story?.leader_debates.at(-1)
  const latestVote = a
    ? [...a.votes].sort((x, y) => y.date.localeCompare(x.date))[0]
    : null

  return (
    <article className="story">
      <header className="story-hero">
        <p className="story-eyebrow">Political Observatory</p>
        <h1>
          {l('Swedish politics through data', 'Svensk politik genom data')}
        </h1>
        <p className="story-sub">
          {l(
            'Decisions, roll calls, debates and political patterns.',
            'Beslut, voteringar, debatter och politiska mönster.',
          )}
        </p>
        <p className="story-meta">
          {l('Sources', 'Källor')}:{' '}
          {l(
            'Riksdagen’s open data, SCB, Valmyndigheten',
            'Riksdagens öppna data, SCB, Valmyndigheten',
          )}
          {now && (
            <>
              {' '}
              · {l('updated', 'uppdaterad')}{' '}
              {dayName(now.generated_at.slice(0, 10))}
            </>
          )}
          {a && (
            <>
              {' '}
              · {l('roll calls', 'voteringar')} {a.votes[0].session}–
              {a.votes.at(-1)!.session}
            </>
          )}
          {story && (
            <>
              {' '}
              · {l('debates', 'debatter')} 1993–
              {story.leader_debates.at(-1)!.date.slice(0, 4)}
            </>
          )}
        </p>
        <dl className="story-kpis">
          <Kpi
            value={
              now
                ? num(now.election.parties.reduce((s, p) => s + p.seats, 0))
                : '…'
            }
            label={l('Seats', 'Mandat')}
          />
          <Kpi
            value={
              now
                ? num(now.election.parties.filter((p) => p.seats > 0).length)
                : '…'
            }
            label={l('Parties in the Riksdag', 'Riksdagspartier')}
          />
          <Kpi
            value={a ? num(a.votes.length) : '…'}
            label={l('Roll calls analysed', 'Analyserade voteringar')}
          />
          <Kpi
            value={meanCohesion != null ? pct(meanCohesion, 1) : '…'}
            label={
              <Info
                term={l(
                  'Average party cohesion',
                  'Genomsnittlig partisammanhållning',
                )}
              >
                {l(
                  'The mean over the eight parties of: cast votes by the party’s members matching the party’s most common vote in each roll call, of all their cast votes.',
                  'Snittet över de åtta partierna av: avgivna röster från partiets ledamöter som stämmer med partiets vanligaste röst i varje votering, av alla deras avgivna röster.',
                )}
              </Info>
            }
          />
        </dl>
        <nav
          className="story-toc"
          aria-label={l('On this page', 'På den här sidan')}
        >
          <ol>
            {TOC.map(([id, en, sv], i) => (
              <li key={id}>
                <a
                  href={`#politik?avsnitt=${id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById(id)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span> {l(en, sv)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {failed && (
        <p role="alert" className="theme-error">
          {failed}
        </p>
      )}

      {now ? (
        <section className="story-section" id="nu" aria-labelledby="nu-q">
          <header className="story-section-head">
            <p className="story-kicker">
              <span>01</span> {l('Sweden now', 'Sverige just nu')}
            </p>
            <h2 id="nu-q">{now.government.government_name}</h2>
            <p className="story-lead">
              {l('Prime minister', 'Statsminister')}{' '}
              {now.government.prime_minister} (
              {now.government.government_parties.join(', ')}
              {now.government.agreement_parties?.length
                ? `; ${l('agreement with', 'avtal med')} ${now.government.agreement_parties.join(', ')}`
                : ''}
              ). {now.government.status_note}
            </p>
          </header>
          <ul className="story-now">
            <li>
              <small>{l('Latest election', 'Senaste valet')}</small>
              <b>{dayName(now.election.election_date)}</b>
              {(() => {
                const top = [...now.election.parties].sort(
                  (x, y) => y.seats - x.seats,
                )[0]
                return `${l('Largest', 'Störst')}: ${partyName(top.party)}, ${top.seats} ${l('seats', 'mandat')}`
              })()}
            </li>
            {latestVote && (
              <li>
                <small>
                  {l(
                    'Latest roll call analysed',
                    'Senast analyserade votering',
                  )}
                </small>
                <b>{dayName(latestVote.date)}</b>
                {latestVote.title}
              </li>
            )}
            {latestDebate && (
              <li>
                <small>
                  {l(
                    'Latest party-leader debate',
                    'Senaste partiledardebatten',
                  )}
                </small>
                <b>{dayName(latestDebate.date)}</b>
                <a
                  href="#debatterna"
                  onClick={(e) => {
                    e.preventDefault()
                    document
                      .getElementById('partiledardebatt')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  {l('Explore it below', 'Utforska den nedan')} ↓
                </a>
              </li>
            )}
          </ul>
        </section>
      ) : (
        !failed && <Skeleton />
      )}

      {now && <Makten now={now} />}
      {a ? (
        <>
          <Besluten a={a} />
          <Skiljelinjerna a={a} />
          {now && (
            <Partierna
              a={a}
              now={now}
              party={party}
              onParty={(parti) => setView({ parti })}
            />
          )}
        </>
      ) : (
        !failed && <Skeleton />
      )}
      {story ? (
        <>
          <Debatterna
            story={story}
            debate={view.debatt}
            onDebate={(debatt) => setView({ debatt })}
          />
          <Ledamoterna
            story={story}
            member={view.ledamot}
            onMember={(ledamot) => setView({ ledamot })}
          />
        </>
      ) : (
        !failed && <Skeleton />
      )}
      {a && <Advanced a={a} />}
      {story && quality && <OmDatan story={story} quality={quality} />}
    </article>
  )
}

function Skeleton() {
  return (
    <div
      className="story-skeleton"
      role="status"
      aria-label={l('Loading', 'Laddar')}
    >
      <span />
      <span />
      <span />
    </div>
  )
}
