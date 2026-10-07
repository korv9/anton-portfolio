/**
 * EU AI Act Observatory (#ai-act): what Regulation (EU) 2024/1689 means for organisations that
 * build or use AI, built from official EU sources only (platform/ingest/eu_ai_act, dbt models
 * under models/{bronze,silver,gold}/eu_ai_act, platform/publish/eu_ai_act/export_ai_act.py).
 *
 * Views: overview, what applies today, timeline, roles, risk classes, obligations, the startup
 * navigator, the Riksdag, job ads, the AI governance timeline, changes and sources, plus an article reader (#ai-act-article?a=6). Filters and the
 * navigator's answers live in the address, so any view can be shared. Every statement drawn from
 * the Act links to its article; interpretations are marked as such.
 */
import { useMemo } from 'react'
import { l } from '../i18n'
import type { Route } from '../router'
import { useViewParams } from '../politik/useViewParams'
import { ProjectNav } from '../projects/ProjectNav'
import { ArticleView } from './ArticleView'
import { useAiAct } from './data'
import { isoToday, nowAndNext } from './logic'
import { NavigatorView } from './Navigator'
import { Jobs } from './Jobs'
import { Politics } from './Politics'
import { Signals } from './Signals'
import { DISCLAIMER, fmtDate, pick } from './shared'
import { ProjectHero } from '../ui/Project'
import {
  Changes,
  Obligations,
  Overview,
  Roles,
  Risk,
  Sources,
  Today,
  TimelineView,
} from './views'
import './aiact.css'

const VIEWS: Record<
  string,
  { title: [string, string]; question: [string, string] }
> = {
  '#ai-act': {
    title: ['EU AI Act Observatory', 'EU AI Act Observatory'],
    question: [
      'What applies now, to whom, and when?',
      'Vad gäller nu, för vem och när?',
    ],
  },
  '#ai-act-today': {
    title: ['What applies today', 'Vad gäller i dag'],
    question: [
      'Which articles apply now, and which are still ahead?',
      'Vilka artiklar gäller nu, och vilka väntar?',
    ],
  },
  '#ai-act-timeline': {
    title: ['Timeline', 'Tidslinje'],
    question: [
      'When does each part of the Act apply?',
      'När börjar varje del av lagen gälla?',
    ],
  },
  '#ai-act-roles': {
    title: ['Who does it apply to?', 'Vem gäller den för?'],
    question: [
      'Which roles does the Act define, and what do they carry?',
      'Vilka roller definierar lagen, och vad bär de?',
    ],
  },
  '#ai-act-risk': {
    title: ['Risk classes', 'Riskklasser'],
    question: [
      'How does the Act scale its rules by risk?',
      'Hur skalar lagen sina regler efter risk?',
    ],
  },
  '#ai-act-obligations': {
    title: ['Obligations', 'Skyldigheter'],
    question: [
      'Who must do what, where is it written, and from when?',
      'Vem ska göra vad, var står det och från när?',
    ],
  },
  '#ai-act-startups': {
    title: ['Startup navigator', 'Navigator för startups'],
    question: [
      'Which parts of the Act might matter for what you build?',
      'Vilka delar av lagen kan vara relevanta för det ni bygger?',
    ],
  },
  '#ai-act-politics': {
    title: ['The Riksdag and AI', 'Riksdagen och AI'],
    question: [
      'How has Swedish political language about AI changed as the AI Act developed?',
      'Hur har det svenska politiska språket om AI förändrats medan AI-förordningen växt fram?',
    ],
  },
  '#ai-act-jobs': {
    title: ['In the job ads', 'I jobbannonserna'],
    question: [
      'How often do Swedish job ads talk about AI governance, compliance and model risk?',
      'Hur ofta talar svenska jobbannonser om AI-styrning, regelefterlevnad och modellrisk?',
    ],
  },
  '#ai-act-signals': {
    title: ['AI governance timeline', 'Tidslinje för AI-styrning'],
    question: [
      'How do the Act, the Riksdag and the job market line up in time?',
      'Hur ligger förordningen, riksdagen och arbetsmarknaden i tid?',
    ],
  },
  '#ai-act-changes': {
    title: ['Changes', 'Ändringar'],
    question: ['What has changed, and when?', 'Vad har ändrats, och när?'],
  },
  '#ai-act-sources': {
    title: ['Sources and method', 'Källor och metod'],
    question: [
      'Where does every fact come from?',
      'Var kommer varje uppgift ifrån?',
    ],
  },
  '#ai-act-article': {
    title: ['Article reader', 'Artikelläsare'],
    question: [
      'The official text, article by article.',
      'Den officiella texten, artikel för artikel.',
    ],
  },
}

const DEFAULTS = {
  actor: '',
  risk: '',
  kind: '',
  svar: '',
  a: '',
  term: 'ai_any',
}

export default function AiActProduct({ route }: { route: Route }) {
  const { data, error } = useAiAct()
  const [params, set] = useViewParams(route, DEFAULTS)
  const path = VIEWS[route.path] ? route.path : '#ai-act'
  const view = VIEWS[path]
  // The reader's date decides what applies now; ?idag=2027-01-01 previews another day.
  const today = useMemo(() => {
    const preview = route.params.get('idag')
    return preview && /^\d{4}-\d{2}-\d{2}$/.test(preview) ? preview : isoToday()
  }, [route.params.toString()])

  const status =
    data && path === '#ai-act' ? nowAndNext(data.timeline, today) : null
  return (
    <div className="aiact">
      {path === '#ai-act' ? (
        <div className="ds-container">
          <ProjectHero
            project="ai-act"
            status={
              status && (
                <dl className="aa-hero-status">
                  {status.latest && (
                    <div>
                      <dt>{l('Applies now', 'Gäller nu')}</dt>
                      <dd>
                        {fmtDate(status.latest.date)}:{' '}
                        {pick({
                          en: status.latest.title_en,
                          sv: status.latest.title_sv,
                        })}
                      </dd>
                    </div>
                  )}
                  {status.next && (
                    <div>
                      <dt>{l('Next', 'Härnäst')}</dt>
                      <dd>
                        {fmtDate(status.next.date)}:{' '}
                        {pick({
                          en: status.next.title_en,
                          sv: status.next.title_sv,
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              )
            }
            nav={[
              {
                href: '#ai-act-roles',
                label: l('Who is affected?', 'Vem berörs?'),
              },
              {
                href: '#ai-act-startups',
                label: l('Startup navigator', 'Startup-navigator'),
              },
              {
                href: '#ai-act-obligations',
                label: l('Obligations', 'Skyldigheter'),
              },
              { href: '#ai-act-changes', label: l('Changes', 'Ändringar') },
              { href: '#ai-act-sources', label: l('Sources', 'Källor') },
            ]}
          >
            <p>
              {l(
                'The EU AI Act read from official EU sources: what applies, to whom and from when, with every obligation linked to its article.',
                'EU:s AI-förordning läst ur officiella EU-källor: vad som gäller, för vem och från när, med varje skyldighet länkad till sin artikel.',
              )}
            </p>
            {data && (
              <p className="aa-hero-meta">
                {l('Consolidated text of', 'Konsoliderad text från')}{' '}
                {fmtDate(data.summary.current_version.published_at)} ·{' '}
                {l('retrieved', 'hämtad')}{' '}
                {fmtDate(data.summary.latest_retrieval)} ·{' '}
                <span className="aa-disclaimer-inline">{l(...DISCLAIMER)}</span>
              </p>
            )}
          </ProjectHero>
        </div>
      ) : (
        <>
          <header className="aa-hero ds-container">
            <p className="aa-kicker">EU AI Act Observatory</p>
            <h1>{l(...view.title)}</h1>
            <p className="aa-question">{l(...view.question)}</p>
            {data && (
              <p className="aa-hero-meta">
                {l('Consolidated text of', 'Konsoliderad text från')}{' '}
                {fmtDate(data.summary.current_version.published_at)} ·{' '}
                {l('retrieved', 'hämtad')}{' '}
                {fmtDate(data.summary.latest_retrieval)} ·{' '}
                <span className="aa-disclaimer-inline">{l(...DISCLAIMER)}</span>
              </p>
            )}
          </header>
          <ProjectNav route={route} />
        </>
      )}
      <div className="aa-body ds-container">
        {error && (
          <p className="aa-lede">
            {l(
              'The AI Act data could not be loaded.',
              'AI Act-datan kunde inte laddas.',
            )}
          </p>
        )}
        {!data && !error && (
          <p className="aa-muted">{l('Loading…', 'Laddar…')}</p>
        )}
        {data && (
          <>
            {path === '#ai-act' && <Overview data={data} today={today} />}
            {path === '#ai-act-today' && <Today data={data} today={today} />}
            {path === '#ai-act-timeline' && (
              <TimelineView data={data} today={today} />
            )}
            {path === '#ai-act-roles' && <Roles data={data} today={today} />}
            {path === '#ai-act-risk' && <Risk data={data} today={today} />}
            {path === '#ai-act-obligations' && (
              <Obligations
                data={data}
                today={today}
                actor={params.actor}
                risk={params.risk}
                setFilter={(f) => set(f)}
              />
            )}
            {path === '#ai-act-startups' && (
              <NavigatorView
                data={data}
                today={today}
                encoded={params.svar}
                setEncoded={(svar) => set({ svar })}
              />
            )}
            {path === '#ai-act-politics' && <Politics data={data} />}
            {path === '#ai-act-jobs' && (
              <Jobs
                data={data}
                term={params.term}
                setTerm={(term) => set({ term })}
              />
            )}
            {path === '#ai-act-signals' && <Signals data={data} />}
            {path === '#ai-act-changes' && (
              <Changes
                data={data}
                today={today}
                kind={params.kind}
                setKind={(kind) => set({ kind })}
              />
            )}
            {path === '#ai-act-sources' && (
              <Sources data={data} today={today} />
            )}
            {path === '#ai-act-article' && (
              <ArticleView data={data} today={today} number={params.a || '1'} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
