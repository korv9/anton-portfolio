/**
 * The job-ad clustering as one theme of the jobs product: the question, why it matters, then
 * the map, the ranked groups and the picked group's profile (ClusterMap).
 */
import { lazy, Suspense } from 'react'
import { l } from '../i18n'
import './clusters.css'

const ClusterMap = lazy(() => import('./ClusterMap'))

export default function ClusteringSection() {
  return (
    <article className="theme cluster-story">
      <header className="theme-head">
        <h1 className="theme-question">
          {l(
            'What groups do IT job ads form?',
            'Vilka grupper bildar IT-annonserna?',
          )}
        </h1>
        <p className="theme-why">
          {l(
            'Job titles suggest four families: Data Engineer, Analytics Engineer, Data Scientist and Software Developer. Here the ads are grouped by how they are written instead, without the titles, and the groups are then held up against the titles.',
            'Jobbtitlarna antyder fyra familjer: Data Engineer, Analytics Engineer, Data Scientist och Software Developer. Här grupperas annonserna i stället efter hur de är skrivna, utan titlarna, och grupperna jämförs sedan med titlarna.',
          )}
        </p>
      </header>
      <Suspense
        fallback={
          <p role="status">
            {l('Loading the semantic map…', 'Laddar den semantiska kartan…')}
          </p>
        }
      >
        <ClusterMap />
      </Suspense>
    </article>
  )
}
