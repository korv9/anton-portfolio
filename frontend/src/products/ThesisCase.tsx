/**
 * The degree project (#thesis): NLP clustering of IT incidents at Fora AB, summarised from the
 * thesis. Aggregates only: no ticket text, cluster ids, internal system names or people.
 * Text: thesisContent.ts and thesisResults.ts; figures: FACTS in thesisFacts.ts.
 */
import { l } from '../i18n'
import { ProjectSection } from '../ui/Project'
import PageHead, { Method } from '../ui/PageHead'
import * as C from './thesisContent'
import type { Lead } from './thesisContent'
import * as R from './thesisResults'
import { ClusterGrid, Maturity, QualityStrip } from './ThesisCharts'
import { FACTS, num, pct } from './thesisFacts'
import './thesis.css'

const Paras = ({ items }: { items: string[] }) =>
  items.map((p) => <p key={p}>{p}</p>)

const Leads = ({ items }: { items: Lead[] }) =>
  items.map((f) => (
    <p key={f.lead}>
      <strong>{f.lead}</strong> {f.text}
    </p>
  ))

export function ThesisPage() {
  return (
    <article className="project-page thesis-page">
      <PageHead
        title="ITSM Clustering"
        sentence={l(
          'My degree project: can text clustering find recurring IT faults that nobody registered as a problem?',
          'Mitt examensarbete: kan klustring av text hitta återkommande IT-fel som ingen har registrerat som problem?',
        )}
        kpis={[
          {
            value: num(FACTS.records),
            label: l('tickets measured', 'mätta ärenden'),
          },
          {
            value: num(FACTS.clusters),
            label: l('clusters found', 'hittade kluster'),
          },
          {
            value: num(FACTS.unlinked),
            label: l(
              'clusters with no problem record',
              'kluster utan problemärende',
            ),
          },
          {
            value: pct(FACTS.iso.analysis),
            label: l(
              'tickets with a root-cause analysis',
              'ärenden med rotorsaksanalys',
            ),
          },
        ]}
      />
      <ProjectSection
        id="thesis-summary"
        title={l('Summary', 'Sammanfattning')}
      >
        <Paras items={C.summary()} />
      </ProjectSection>
      <ProjectSection id="thesis-problem" title={l('The problem', 'Problemet')}>
        <Paras items={C.problem()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-purpose"
        title={l('Purpose and questions', 'Syfte och frågeställningar')}
      >
        <p>{C.purpose()}</p>
        <ol>
          {C.questions().map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </ProjectSection>
      <ProjectSection
        id="thesis-case"
        title={l('Case and data', 'Fallet och datan')}
      >
        <Paras items={C.caseData()} />
      </ProjectSection>
      <ProjectSection id="thesis-method" title={l('Method', 'Metod')}>
        <Leads items={C.method()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-data"
        title={l('Data quality, ISO/IEC 25012', 'Datakvalitet, ISO/IEC 25012')}
      >
        <QualityStrip />
      </ProjectSection>
      <ProjectSection
        id="thesis-years"
        title={l('Fields filled per year', 'Ifyllda fält per år')}
      >
        <Maturity />
        <p>{C.years()}</p>
      </ProjectSection>
      <ProjectSection
        id="thesis-quality"
        title={l(
          'Clusters with and without a problem record',
          'Kluster med och utan problemärende',
        )}
      >
        <ClusterGrid />
        <Paras items={C.clusterText()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-findings"
        title={l('Three findings', 'Tre fynd')}
      >
        <Leads items={R.findings()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-patterns"
        title={l('Priority and fragmentation', 'Prioritet och fragmentering')}
      >
        <Paras items={R.patterns()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-conclusions"
        title={l('Conclusions', 'Slutsatser')}
      >
        <Paras items={R.conclusions()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-limitations"
        title={l('Limitations', 'Begränsningar')}
      >
        <Paras items={R.limitations()} />
      </ProjectSection>
      <ProjectSection
        id="thesis-future"
        title={l('Future work', 'Framtida arbete')}
      >
        <Paras items={R.future()} />
      </ProjectSection>
      <Method
        summary={l('Technical details · source', 'Tekniska detaljer · källa')}
      >
        <div id="thesis-workflow">
          <Paras items={R.technical()} />
        </div>
      </Method>
    </article>
  )
}
