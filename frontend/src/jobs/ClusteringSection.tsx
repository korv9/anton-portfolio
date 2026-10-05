import { lazy, Suspense, useEffect, useState } from 'react'
import { l } from '../i18n'
import { SectionHeader } from '../ui/Editorial'
import './clusters.css'

const ClusterMap = lazy(() => import('./ClusterMap'))

export default function ClusteringSection({
  initialOpen = false,
}: {
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  useEffect(() => {
    if (initialOpen) {
      setOpen(true)
      requestAnimationFrame(() =>
        document
          .getElementById('job-market-clusters')
          ?.scrollIntoView({ block: 'start' }),
      )
    }
  }, [initialOpen])
  return (
    <section className="cluster-story" id="job-market-clusters">
      <SectionHeader
        number="03"
        label={l('Unsupervised learning', 'Oövervakad inlärning')}
        title={l(
          'What does the Swedish tech job market actually look like?',
          'Hur ser den svenska IT-arbetsmarknaden egentligen ut?',
        )}
      />
      <p className="ds-body">
        {l(
          'Job titles suggest four broad groups: Data Engineer, Analytics Engineer, Data Scientist and Software Developer. But the language of advertisements may cross those boundaries.',
          'Jobbtitlar antyder fyra breda grupper: Data Engineer, Analytics Engineer, Data Scientist och Software Developer. Men språket i annonserna kan korsa de gränserna.',
        )}
      </p>
      <p className="ds-body">
        {l(
          'This analysis embeds Swedish and English advertisement text locally, reduces the semantic space with UMAP and lets HDBSCAN find dense groups without specifying their number. Compare the discovered structure with the existing labels.',
          'Analysen bäddar in svensk och engelsk annonstext lokalt, reducerar det semantiska rummet med UMAP och låter HDBSCAN hitta täta grupper utan ett förutbestämt antal. Jämför den upptäckta strukturen med de befintliga etiketterna.',
        )}
      </p>
      {open ? (
        <Suspense
          fallback={
            <p role="status">{l('Loading explorer…', 'Laddar utforskaren…')}</p>
          }
        >
          <ClusterMap />
        </Suspense>
      ) : (
        <button className="ds-button secondary" onClick={() => setOpen(true)}>
          {l('Explore the semantic map', 'Utforska den semantiska kartan')} →
        </button>
      )}
    </section>
  )
}
