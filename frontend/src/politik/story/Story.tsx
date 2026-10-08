/**
 * Svensk politik genom data: the politics product's front page, read first, explore second.
 *
 * The opening question (what separates the parties in practice?) is answered in a sentence
 * from the roll-call data. Then three questions: the situation right now (government and
 * seats), where the parties differ most (one chart: the most divided policy areas) and what to
 * explore next. Everything else (decisions, the party fingerprint, debates, members, the
 * voting map) is one click deeper under "More analyses", and sources, method and data quality
 * under their own fold. Choosing a party, debate or member in the address opens the analyses.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { l } from '../../i18n'
import { load, type Now } from '../../parliament/data'
import type { Route } from '../../router'
import { RIKSDAG_PARTIES } from '../../parties/identity'
import { useViewParams } from '../useViewParams'
import { dayName, num, pct } from '../controls'
import { useStory, useVoteAnalytics } from '../analytics/load'
import { areaName } from '../analytics/areas'
import { Info, Kpi } from './parts'
import Makten from './Makten'
import Besluten from './Besluten'
import Skiljelinjerna, { dividingLines } from './Skiljelinjerna'
import Partierna from './Partierna'
import Debatterna from './Debatterna'
import Ledamoterna from './Ledamoterna'
import Advanced from './Advanced'
import OmDatan from './OmDatan'
import { ProjectHero } from '../../ui/Project'
import { partiesOf, withParties } from '../partySelection'
import {
  DataQuestion,
  ExploreSection,
  MethodSummary,
  SourceCaption,
  StoryNext,
} from '../../ui/Story'
import './story.css'

const DEFAULTS = { parti: 'S', debatt: '', ledamot: '' }

export default function Story({
  route,
  slicer,
}: {
  route: Route
  /** The party bar, placed under the first screen rather than above it. */
  slicer?: ReactNode
}) {
  const [view, setView] = useViewParams(route, DEFAULTS)
  const parties = partiesOf(route.params)
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

  const lines = a ? dividingLines(a) : null
  // A shared link that chose a party, debate or member opens the deeper analyses.
  const deep = ['parti', 'debatt', 'ledamot'].some((k) => route.params.has(k))

  return (
    <article className="story">
      <ProjectHero
        project="politics"
        finding={
          lines?.topArea
            ? l(
                `Parties differ most in ${areaName(lines.topArea.committee).toLowerCase()}. Of ${num(a!.votes.length)} roll calls, ${lines.closest.a} and ${lines.closest.b} voted the same way most often (${pct(lines.closest.pct, 0)}), ${lines.furthest.a} and ${lines.furthest.b} least often (${pct(lines.furthest.pct, 0)}).`,
                `Partierna skiljer sig mest inom ${areaName(lines.topArea.committee).toLowerCase()}. Av ${num(a!.votes.length)} voteringar röstade ${lines.closest.a} och ${lines.closest.b} oftast lika (${pct(lines.closest.pct, 0)}), ${lines.furthest.a} och ${lines.furthest.b} mest sällan (${pct(lines.furthest.pct, 0)}).`,
              )
            : undefined
        }
        nav={[
          { href: '#politik', label: l('Overview', 'Översikt'), current: true },
          { href: withParties('#politik-budget', parties), label: 'Budget' },
          {
            href: withParties('#politik-partier', parties),
            label: l('Parties', 'Partier'),
          },
          {
            href: withParties('#politik-roster', parties),
            label: l('Voting', 'Röster'),
          },
          {
            href: withParties('#politik-sakdebatter', parties),
            label: l('Debates', 'Debatter'),
          },
          {
            href: withParties('#politik-kallor', parties),
            label: l('Sources', 'Källor'),
          },
        ]}
      >
        <p>
          {l(
            'Decisions, roll calls, debates and budgets in the Riksdag, party by party, from open data.',
            'Beslut, voteringar, debatter och budgetar i riksdagen, parti för parti, från öppna data.',
          )}
        </p>
        <SourceCaption
          source={l(
            'Riksdagen’s open data, SCB, Valmyndigheten',
            'Riksdagens öppna data, SCB, Valmyndigheten',
          )}
          period={
            a
              ? `${l('roll calls', 'voteringar')} ${a.votes[0].session}–${a.votes.at(-1)!.session}`
              : undefined
          }
          definition={
            now
              ? `${l('updated', 'uppdaterad')} ${dayName(now.generated_at.slice(0, 10))}`
              : undefined
          }
        />
      </ProjectHero>
      {slicer}

      {failed && (
        <p role="alert" className="theme-error">
          {failed}
        </p>
      )}

      {now ? (
        <Makten
          now={now}
          facts={
            <ul className="story-now">
              <li>
                <small>{l('Latest election', 'Senaste valet')}</small>
                <b>{dayName(now.election.election_date)}</b>
                {now.government.status_note}
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
                  <a href="#politik-partiledardebatter">
                    {l('The party-leader debates', 'Partiledardebatterna')}
                  </a>
                </li>
              )}
            </ul>
          }
        />
      ) : (
        !failed && <Skeleton />
      )}
      {a ? <Skiljelinjerna a={a} /> : !failed && <Skeleton />}

      <section
        className="story-section"
        id="utforska"
        aria-labelledby="utforska-q"
      >
        <DataQuestion
          id="utforska-q"
          eyebrow={l('Explore', 'Utforska')}
          question={l(
            'What should you explore next?',
            'Vad vill du utforska härnäst?',
          )}
        />
        <StoryNext
          label={l('The politics pages', 'Politiksidorna')}
          links={[
            {
              href: '#politik-roster',
              title: l('How the parties vote', 'Hur partierna röstar'),
              line: l(
                'Who votes with whom, session by session since 1993.',
                'Vem som röstar med vem, riksmöte för riksmöte sedan 1993.',
              ),
            },
            {
              href: '#politik-tal',
              title: l('What they talk about', 'Vad de pratar om'),
              line: l(
                'Each party’s issues in its speeches, over time.',
                'Varje partis frågor i anförandena, över tid.',
              ),
            },
            {
              href: '#politik-budget',
              title: l(
                'What they want to spend on',
                'Vad de vill lägga pengar på',
              ),
              line: l(
                'Each party’s budget motion against the government’s budget.',
                'Varje partis budgetmotion mot regeringens budget.',
              ),
            },
            {
              href: '#politik-partier',
              title: l('The parties', 'Partierna'),
              line: l(
                'One page per party: elections, members, votes and debates.',
                'En sida per parti: val, ledamöter, röster och debatter.',
              ),
            },
            {
              href: '#politik-valjarna',
              title: l('What voters think', 'Vad väljarna tycker'),
              line: l(
                'Support between elections in SCB’s party preference survey.',
                'Stödet mellan valen i SCB:s partisympatiundersökning.',
              ),
            },
          ]}
        />
      </section>

      <ExploreSection
        id="fler-analyser"
        title={l('More analyses', 'Fler analyser')}
        summary={l(
          'Decisions and party cohesion, one party’s fingerprint, the party-leader debates, the members and the voting map.',
          'Beslut och partisammanhållning, ett partis fingeravtryck, partiledardebatterna, ledamöterna och röstkartan.',
        )}
        defaultOpen={deep}
      >
        {a && now && (
          <>
            <Besluten a={a} />
            <Partierna
              a={a}
              now={now}
              party={party}
              onParty={(parti) => setView({ parti })}
            />
          </>
        )}
        {story && (
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
        )}
        {a && <Advanced a={a} />}
      </ExploreSection>

      <ExploreSection
        id="om-datan-fold"
        title={l(
          'Sources, method and data quality',
          'Källor, metod och datakvalitet',
        )}
        summary={l(
          'The pipeline, what the cleaning left out, every definition and the quality profile.',
          'Pipelinen, vad rensningen lämnade utanför, varje definition och kvalitetsprofilen.',
        )}
      >
        <div className="story-diagnostic">
          <dl>
            {now && (
              <Kpi
                value={num(
                  now.election.parties.reduce((t, p) => t + p.seats, 0),
                )}
                label={l('Seats', 'Mandat')}
              />
            )}
            {a && (
              <Kpi
                value={num(a.votes.length)}
                label={l('Roll calls analysed', 'Analyserade voteringar')}
              />
            )}
            {meanCohesion != null && (
              <Kpi
                value={pct(meanCohesion, 1)}
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
            )}
          </dl>
        </div>
        {story && quality && <OmDatan story={story} quality={quality} />}
      </ExploreSection>

      <MethodSummary
        lineage={[
          l('Riksdagen, SCB, Valmyndigheten', 'Riksdagen, SCB, Valmyndigheten'),
          l('Python ingestion', 'inläsning i Python'),
          'dbt + DuckDB',
          'Parquet',
          'React',
        ]}
        quality={l(
          'Every figure keeps its source and definition: a party’s position is the vote most of its members cast, as Riksdagen reports it.',
          'Varje siffra behåller sin källa och definition: ett partis ståndpunkt är den röst flest av dess ledamöter lade, som Riksdagen redovisar den.',
        )}
        more={[
          {
            href: '#politik-kallor',
            label: l('Sources and method', 'Källor och metod'),
          },
        ]}
      />
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
