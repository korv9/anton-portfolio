/** A project's cluster maps inside its report; the map code loads only when the tab opens. */
import { Suspense, lazy } from 'react'
import { l } from '../i18n'

const ProjectMaps = lazy(() =>
  import('./ClusterVisualsPage').then((m) => ({ default: m.ProjectMaps })),
)

export default function ReportMaps({ ids }: { ids: string[] }) {
  return (
    <Suspense
      fallback={<p role="status">{l('Loading the map…', 'Laddar kartan…')}</p>}
    >
      <ProjectMaps ids={ids} />
    </Suspense>
  )
}
