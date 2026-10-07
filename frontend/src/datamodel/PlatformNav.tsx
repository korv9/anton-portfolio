/**
 * The three views of the data platform under the hood: its tables, how they relate, and the
 * published datasets with the pipeline's status.
 */
import { l } from '../i18n'
import { ProjectSubnav } from '../ui/Project'

export function PlatformNav({ current }: { current: string }) {
  return (
    <ProjectSubnav
      label={l('Data platform', 'Dataplattformen')}
      items={[
        ['#data-model', l('Tables', 'Tabeller')],
        ['#er', l('Relations', 'Relationer')],
        ['#data-catalogue', l('Catalogue and status', 'Katalog och status')],
      ].map(([href, label]) => ({ href, label, current: href === current }))}
    />
  )
}
