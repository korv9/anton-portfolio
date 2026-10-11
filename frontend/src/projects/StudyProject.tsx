import { l } from '../i18n'
import { PROJECTS } from './projectRegistry'
import { DashHeader, ChartCard } from '../ui/dash/Dash'
import ProjectTech from './ProjectTech'

export default function StudyProject({ id }: { id: 'rag' | 'mimii' }) {
  const entry = PROJECTS.find((p) => p.id === id)!
  const b = (text: { en: string; sv: string }) => l(text.en, text.sv)
  return (
    <div className="dk study-dashboard">
      <DashHeader
        crumbs={[
          { label: l('Projects', 'Projekt'), href: '#projekt' },
          { label: b(entry.descriptor) },
        ]}
        title={b(entry.title)}
        lead={b(entry.summary)}
        status={{
          text: l(
            'Study project. No public demo or result dataset.',
            'Studieprojekt. Ingen offentlig demo eller resultatdata.',
          ),
          tone: 'idle',
        }}
        code={typeof entry.code === 'string' ? entry.code : undefined}
      />
      <div className="dk-grid">
        <ChartCard
          title={b(entry.question)}
          span={8}
          sub={l('Documented implementation', 'Dokumenterad implementation')}
        >
          <p>{b(entry.built)}</p>
          <p>{b(entry.result)}</p>
        </ChartCard>
        <ChartCard title={l('Tools', 'Verktyg')} span={4}>
          <ul>
            {entry.tech.map((tool) => (
              <li key={tool}>{tool}</li>
            ))}
          </ul>
        </ChartCard>
      </div>
      <ProjectTech project={id} />
    </div>
  )
}
