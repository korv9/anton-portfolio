import { l } from '../i18n'
import { PROJECTS } from '../projects/projectRegistry'
import { ProjectHero, ProjectSection } from '../ui/Project'
import { ProjectDepth } from '../projects/ProjectStructure'

export default function LakehousePage() {
  const project = PROJECTS.find((p) => p.id === 'diva-lakehouse')!
  return (
    <article className="project-page">
      <ProjectHero project={project.id}>
        <p>{l(project.summary.en, project.summary.sv)}</p>
      </ProjectHero>
      <ProjectSection
        title={l('Ingestion and updates', 'Inläsning och uppdateringar')}
      >
        <p>{l(project.question.en, project.question.sv)}</p>
        <ol className="engineering-flow">
          <li>OAI-PMH → XML</li>
          <li>Bronze → Silver</li>
          <li>Delta MERGE → Gold</li>
          <li>Fabric notebooks</li>
        </ol>
      </ProjectSection>
      <ProjectSection title={l('Verification', 'Verifiering')}>
        <p>{l(project.result.en, project.result.sv)}</p>
      </ProjectSection>
      <ProjectDepth project={project.id}>
        <p>{l(project.built.en, project.built.sv)}</p>
      </ProjectDepth>
    </article>
  )
}
