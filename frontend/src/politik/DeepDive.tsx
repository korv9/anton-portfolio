/**
 * A detailed view inside the politics product: the older full analyses, unchanged, under a
 * short heading that says where you are and leads back to the theme they belong to.
 */
import { lazy } from 'react'
import { l } from '../i18n'
import TopicNav from '../TopicNav'
import { THEMES, deepDiveOf } from './nav'

const NowPage = lazy(() => import('../parliament/NowPage'))
const PoliticsLab = lazy(() => import('../politics/PoliticsLab'))
const SpeechBrowser = lazy(() => import('../politics/SpeechBrowser'))
const LanguageMap = lazy(() => import('../politics/LanguageMap'))
const BudgetLab = lazy(() => import('../BudgetLab'))
const BudgetOutturn = lazy(() => import('../BudgetOutturn'))
const DataExplorer = lazy(() => import('../products/DataExplorer'))
const PartiesPage = lazy(() => import('../parties/PartiesPage'))
const IssuePage = lazy(() => import('../parliament/IssuePage'))
const TaxesPage = lazy(() => import('../taxes/TaxesPage'))

function Content({ path }: { path: string }) {
  if (path.startsWith('#now-')) return <NowPage view={path} embedded />
  if (['#politics', '#politics-votes', '#politics-laws'].includes(path))
    return (
      <div className="reports">
        <PoliticsLab />
      </div>
    )
  if (path === '#data-explorer')
    return (
      <div className="reports">
        <SpeechBrowser />
      </div>
    )
  if (path === '#debates')
    return (
      <div className="reports">
        <LanguageMap />
      </div>
    )
  if (path === '#raw-data')
    return (
      <div className="reports">
        <DataExplorer />
      </div>
    )
  if (path.startsWith('#budget-'))
    return (
      <div className="budget-page">
        <TopicNav
          label={l('Budget view', 'Budgetvy')}
          active={path === '#budget-comparison' ? '#budget-proposals' : path}
          items={[
            ['#budget-proposals', 'Proposals', 'Förslag'],
            ['#budget-explore', 'Budget and debate', 'Budget och debatt'],
            ['#budget-outturn', 'Outturn', 'Utfall'],
          ]}
        />
        <div className="reports">
          {path === '#budget-outturn' ? (
            <BudgetOutturn />
          ) : (
            <BudgetLab
              view={path === '#budget-explore' ? 'explore' : 'proposals'}
            />
          )}
        </div>
      </div>
    )
  if (path.startsWith('#parties')) return <PartiesPage view={path} />
  if (path.startsWith('#issue-'))
    return <IssuePage issueKey={path.slice('#issue-'.length)} />
  if (path.startsWith('#taxes')) return <TaxesPage view={path} />
  return null
}

export default function DeepDive({ path }: { path: string }) {
  const found = deepDiveOf(path)
  const parent = THEMES.find((t) => t.key === found?.dive.parent)
  return (
    <div className="deep-dive">
      <header className="deep-dive-head">
        <p className="ds-label">
          {parent && (
            <>
              <a href={parent.path}>{l(parent.en, parent.sv)}</a>
              {' · '}
            </>
          )}
          {l('In depth', 'Fördjupning')}
        </p>
        {found && <h1>{l(found.dive.en, found.dive.sv)}</h1>}
      </header>
      <div className="project-page politics-page deep-dive-body">
        <Content path={path} />
      </div>
    </div>
  )
}
