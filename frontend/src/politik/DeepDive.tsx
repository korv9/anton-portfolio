/**
 * A tool inside the politics product that is not a theme: the seat counter and the speech
 * search. A short heading says where you are and leads back to the theme they belong to.
 */
import { lazy, useEffect, useState } from 'react'
import { l } from '../i18n'
import { load, type Now } from '../parliament/data'
import { THEMES, deepDiveOf } from './nav'

const SeatBar = lazy(() => import('../parliament/SeatBar'))
const SpeechBrowser = lazy(() => import('../politics/SpeechBrowser'))
import '../politics/politics.css'

function Seats() {
  const [now, setNow] = useState<Now | null>(null)
  useEffect(() => {
    load<Now>('parliament/now.json')
      .then(setNow)
      .catch(() => setNow(null))
  }, [])
  if (!now) return <p className="theme-loading">{l('Loading…', 'Laddar…')}</p>
  return (
    <SeatBar parties={now.election.parties} majority={now.election.majority} />
  )
}

function Content({ path }: { path: string }) {
  if (path === '#politik-mandat') return <Seats />
  if (path === '#politik-sok')
    return (
      <div className="reports">
        <SpeechBrowser />
      </div>
    )
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
              {', '}
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
