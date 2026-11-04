/**
 * Labs (#labs): every lab with its one line, from the rail's Labs group. The rail lists the
 * labs under Labs only while one of them is open, so this page is where they are all seen.
 */
import { l } from '../i18n'
import PageHead from '../ui/PageHead'
import { GROUPS } from '../site/ProjectRail'
import ProjectIndex from './ProjectIndex'
import './hub.css'

export default function LabsPage() {
  return (
    <article className="hub-overview" id="labs">
      <PageHead
        title={l('Labs', 'Labb')}
        sentence={l(
          'Smaller studies on the same platform; some are still experiments.',
          'Mindre studier på samma plattform; några är fortfarande experiment.',
        )}
      />
      <ProjectIndex groups={GROUPS.filter((group) => group.en === 'Labs')} />
    </article>
  )
}
