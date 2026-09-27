import { t } from '../i18n'
import { useEffect, useState } from 'react'
import DataExplorer from './DataExplorer'

export default function ProjectDataDisclosure({
  title,
  sectionId,
  initialDataset,
}: {
  title: string
  sectionId: string
  initialDataset: string
}) {
  const [expanded, setExpanded] = useState(
    () => window.location.hash === '#' + sectionId,
  )
  useEffect(() => {
    const followLink = () => {
      if (window.location.hash === '#' + sectionId) setExpanded(true)
    }
    window.addEventListener('hashchange', followLink)
    return () => window.removeEventListener('hashchange', followLink)
  }, [sectionId])
  return (
    <details
      className="technical-data"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{t(title)}</summary>
      {expanded && (
        <DataExplorer initialDataset={initialDataset} sectionId={sectionId} />
      )}
    </details>
  )
}
