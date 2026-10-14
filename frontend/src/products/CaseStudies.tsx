/** Project pages that are a single report: DrugComb, Allegoria, the degree project and Homie. */
import { lazy } from 'react'
import { l, t } from '../i18n'
import { ProjectHero, ProjectSection } from '../ui/Project'
import { ProjectDepth } from '../projects/ProjectStructure'
import ProjectTech from '../projects/ProjectTech'
import { Stage, StageBlock, StageFacts, StageTools } from '../ui/Stage'
import HomieFlow from './HomieFlow'
import type { Route } from '../router'
import { DeepPage, ReportFrame } from '../report/ReportShell'
import './mlviz.css'

const DrugCombReport = lazy(() => import('./DrugCombReport'))
const HomieProject = lazy(() => import('./HomieProject'))
const ProjectDataDisclosure = lazy(() => import('./ProjectDataDisclosure'))

export function DrugCombPage({ route }: { route: Route }) {
  return (
    <ReportFrame>
      {route.path === '#drugcomb-data' ? (
        <DeepPage id="drugcomb-tables" back="#drugcomb" name="Drug Synergy Lab">
          <h1>{l('Result tables', 'Resultattabeller')}</h1>
          <ProjectDataDisclosure
            title={t('Result tables and downloads')}
            initialDataset="drugcomb_metrics"
            sectionId="drugcomb-data"
          />
        </DeepPage>
      ) : (
        <DrugCombReport route={route} />
      )}
    </ReportFrame>
  )
}

export function ThesisPage() {
  return (
    <article className="project-page thesis-page">
      <ProjectHero
        project="thesis"
        question={l(
          'Recurring IT faults can be hard to spot when support tickets are handled one at a time.',
          'Återkommande IT-fel är svåra att upptäcka när supportärenden hanteras ett i taget.',
        )}
      >
        <p>
          {l(
            'For his 2026 degree project, Anton reviewed documentation quality at Fora AB using ISO/IEC 25012 and built a text analysis pipeline. It grouped similar support tickets and flagged groups without an existing problem record link for investigation by the IT team.',
            'I sitt examensarbete 2026 granskade Anton dokumentationskvaliteten hos Fora AB med ISO/IEC 25012 och byggde ett flöde för textanalys. Det grupperade liknande supportärenden och flaggade grupper utan koppling till befintliga problemposter för IT-teamets utredning.',
          )}
        </p>
      </ProjectHero>
      <section id="thesis-workflow" className="project-section">
        <h2>
          {l(
            'From incidents to review candidates',
            'Från incidenter till granskningskandidater',
          )}
        </h2>
        <ol className="engineering-flow">
          <li>
            <strong>16 811</strong>
            {l('Tickets in the selected run', 'Ärenden i den valda körningen')}
          </li>
          <li>
            <strong>121</strong>
            {l('Groups of similar tickets', 'Grupper av liknande ärenden')}
          </li>
          <li>
            <strong>72</strong>
            {l('Groups without a problem link', 'Grupper utan problemkoppling')}
          </li>
        </ol>
        <p>
          {l(
            'These groups, called clusters, contained similar incident texts. The 72 unlinked groups covered 5,605 tickets, including registration artefacts and groups that still needed interpretation. The thesis highlighted 12 groups with 650 tickets as a subset for further investigation.',
            'Grupperna, som kallas kluster, innehöll liknande incidenttexter. De 72 grupperna utan problemkoppling omfattade 5 605 ärenden, inklusive registreringsartefakter och grupper som ännu behövde tolkas. Arbetet lyfte fram 12 grupper med 650 ärenden som en delmängd för fortsatt utredning.',
          )}
        </p>
        <p>
          {l(
            'A missing link indicates a documentation gap. The candidates need operational review before they can be treated as shared root causes. The study reports no measured time saving or automatically resolved faults.',
            'En saknad koppling visar ett dokumentationsgap. Kandidaterna behöver verksamhetens granskning innan de kan bedömas ha gemensamma rotorsaker. Studien redovisar ingen uppmätt tidsbesparing eller automatiskt lösta fel.',
          )}
        </p>
      </section>
      <ProjectSection
        id="thesis-quality"
        title={l(
          'What the data quality review showed',
          'Vad datakvalitetsgranskningen visade',
        )}
      >
        <p>
          {l(
            'The review covered 21,633 incident records and five dimensions from ISO/IEC 25012. It asked whether the records contained enough reliable information to understand recurring faults. Data that supports day-to-day ticket handling can still be too incomplete or too general for analysis.',
            'Granskningen omfattade 21 633 incidentposter och fem dimensioner ur ISO/IEC 25012. Den undersökte om ärendena innehöll tillräckligt tillförlitlig information för att förstå återkommande fel. Data som fungerar i den dagliga ärendehanteringen kan ändå vara för ofullständig eller för generell för analys.',
          )}
        </p>
        <div className="project-depth-notes">
          <section>
            <h3>
              {l(
                'Completeness: what was actually documented?',
                'Fullständighet: vad var faktiskt dokumenterat?',
              )}
            </h3>
            <p>
              {l(
                'Every ticket had a subject and 90.4% had a description, but only 4.2% had root-cause analysis notes. A populated field could also be misleading: the solution field was filled in 82.2% of records, while only 3.8% contained manual entries. Much of its content was automatically supplied standard text.',
                'Alla ärenden hade en ämnesrad och 90,4 % en beskrivning, men bara 4,2 % hade anteckningar om rotorsaksanalys. Ett ifyllt fält kunde också vara missvisande: lösningsfältet var ifyllt i 82,2 % av posterna, medan bara 3,8 % hade manuella värden. Mycket av innehållet var automatiskt infogad standardtext.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Accuracy: did the text describe the fault?',
                'Exakthet: beskrev texten felet?',
              )}
            </h3>
            <p>
              {l(
                'A user description often captured the symptom, while analysis notes could explain the technical cause. The structured categories were broad: only 15 main categories and 50 subcategories covered the incidents. Formally correct values therefore gave limited detail about individual faults. Without an independent reference for each ticket, accuracy could only be assessed indirectly.',
                'Användarens beskrivning fångade ofta symptomet, medan analysanteckningar kunde förklara den tekniska orsaken. De strukturerade kategorierna var grova: bara 15 huvudkategorier och 50 underkategorier täckte incidenterna. Formellt korrekta värden gav därför begränsad information om enskilda fel. Utan ett oberoende facit för varje ärende kunde exaktheten bara bedömas indirekt.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Consistency: valid values were not enough',
                'Konsistens: giltiga värden räckte inte',
              )}
            </h3>
            <p>
              {l(
                'Status and priority had valid system values in 100% of records, because Freshservice enforced them. That established structural consistency, but did not show that agents had made an accurate assessment. Low and medium priorities dominated, giving limited differentiation. A clean schema could still contain weak operational information.',
                'Status och prioritet hade giltiga systemvärden i 100 % av posterna, eftersom Freshservice krävde det. Det visade strukturell konsistens, men inte att handläggarna hade gjort en korrekt bedömning. Låg och medelhög prioritet dominerade och gav begränsad differentiering. Ett korrekt schema kunde fortfarande innehålla svag verksamhetsinformation.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Uniqueness: repeated reports affected the picture',
                'Unikhet: upprepade rapporter påverkade bilden',
              )}
            </h3>
            <p>
              {l(
                'Freshservice duplicate detection marked 92.8% of records as non-duplicates across the period. This fell to 82.8% in 2021 and 89.8% in 2025. Repeated reports can inflate incident volumes and overrepresent text patterns. The measure used subject similarity within a short time window; it was not a guarantee that all semantically similar incidents had been found.',
                'Freshservices dubblettdetektering klassade 92,8 % av posterna som icke-dubbletter över perioden. Andelen sjönk till 82,8 % år 2021 och 89,8 % år 2025. Upprepade rapporter kan förstora incidentvolymer och överrepresentera textmönster. Måttet byggde på liknande ämnesrader inom ett kort tidsfönster; det garanterade inte att alla innehållsmässigt liknande incidenter hade hittats.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Traceability: could incidents be linked to problems?',
                'Spårbarhet: gick incidenterna att koppla till problem?',
              )}
            </h3>
            <p>
              {l(
                'Only 5.1% of incidents had a link to a registered problem across the period, rising to 15.7% in the partial year 2026. Without those links, it was difficult to trace repeated symptoms to an investigation or use the history as a reference for the model. An unlinked incident could still concern a known fault whose relationship had not been recorded.',
                'Bara 5,1 % av incidenterna hade en koppling till ett registrerat problem över perioden, jämfört med 15,7 % under delåret 2026. Utan länkarna var det svårt att följa återkommande symptom till en utredning eller använda historiken som referens för modellen. En olänkad incident kunde fortfarande gälla ett känt fel vars samband inte hade dokumenterats.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l(
                'Process changes made quality a moving target',
                'Processförändringar gjorde kvaliteten tidsberoende',
              )}
            </h3>
            <p>
              {l(
                'Category and subcategory completion reached 99.9% in 2026 after very limited use in the early years. Root-cause notes were present in 11.7% of records in 2025 and 13.3% in the partial year 2026. The same field could therefore mean different things in different years. The thesis identified documentation and process maturity as a main constraint; richer notes and clearer links were needed alongside improvements to the analysis pipeline.',
                'Fyllnadsgraden för kategori och underkategori nådde 99,9 % år 2026 efter mycket begränsad användning under de tidiga åren. Rotorsaksanteckningar fanns i 11,7 % av posterna år 2025 och 13,3 % under delåret 2026. Samma fält kunde därför betyda olika saker under olika år. Arbetet pekade ut dokumentation och processmognad som en huvudbegränsning; utförligare anteckningar och tydligare länkar behövdes tillsammans med förbättringar av analysflödet.',
              )}
            </p>
          </section>
        </div>
      </ProjectSection>
      <ProjectSection
        id="thesis-evaluation"
        title={l('Model evaluation', 'Modellutvärdering')}
      >
        <p>
          {l(
            'Silhouette measures how separated the groups are in the ten-dimensional UMAP space. In the selected text_weighted run, the thesis reported:',
            'Silhuettvärdet mäter hur åtskilda grupperna är i UMAP-rymden med tio dimensioner. För den valda körningen med text_weighted redovisade arbetet:',
          )}
        </p>
        <StageFacts
          rows={[
            [
              l('HDBSCAN, 121 groups', 'HDBSCAN, 121 grupper'),
              (0.706).toLocaleString(l('en-GB', 'sv-SE'), {
                minimumFractionDigits: 4,
              }),
            ],
            [
              l('K-means, 73 groups', 'K-means, 73 grupper'),
              (0.5342).toLocaleString(l('en-GB', 'sv-SE'), {
                minimumFractionDigits: 4,
              }),
            ],
            [
              l(
                'HDBSCAN noise, excluded from silhouette',
                'HDBSCAN-brus, undantaget från silhuett',
              ),
              (0.277).toLocaleString(l('en-GB', 'sv-SE'), {
                style: 'percent',
                minimumFractionDigits: 1,
              }),
            ],
          ]}
        />
        <p>
          {l(
            'The score was about 32% higher for HDBSCAN. It was calculated on the 72.3% of tickets assigned to groups, while K-means was evaluated on all tickets. This uneven comparison measures geometry, not a 32% improvement in finding root causes.',
            'Värdet var cirka 32 % högre för HDBSCAN. Det beräknades på de 72,3 % av ärendena som tilldelades grupper, medan K-means utvärderades på alla ärenden. Jämförelsen gäller olika delmängder och mäter geometri, inte 32 % bättre identifiering av rotorsaker.',
          )}
        </p>
        <p>
          {l(
            'Existing problem links supplied a limited reference: 49 of the 121 groups contained at least one linked ticket. These links were sparse and uneven over time. Planned interviews were not carried out, so the candidates still lacked that operational validation.',
            'Befintliga problemkopplingar gav en begränsad referens: 49 av de 121 grupperna innehöll minst ett kopplat ärende. Länkarna var glesa och ojämnt fördelade över tid. Planerade intervjuer genomfördes inte, så kandidaterna saknade den verksamhetsvalideringen.',
          )}
        </p>
      </ProjectSection>
      <ProjectDepth project="thesis">
        <div className="project-depth-notes">
          <section>
            <h3>
              {l('Population and data quality', 'Population och datakvalitet')}
            </h3>
            <p>
              {l(
                'The case study used Freshservice incidents from Fora AB during 2020-2026. Data quality was assessed on 21,633 records using five ISO/IEC 25012 dimensions. After further filtering and deduplication, the NLP corpus contained 19,847 unique incidents; the selected text configuration used 16,811. Other configurations used different subsets.',
                'Fallstudien använde Freshservice-incidenter från Fora AB under 2020-2026. Datakvaliteten bedömdes på 21 633 poster med fem dimensioner ur ISO/IEC 25012. Efter ytterligare filtrering och dubblettrensning omfattade NLP-korpusen 19 847 unika incidenter; den valda textkonfigurationen använde 16 811. Andra konfigurationer använde andra delmängder.',
              )}
            </p>
          </section>
          <section>
            <h3>{l('Pipeline and privacy', 'Pipeline och personuppgifter')}</h3>
            <p>
              {l(
                'Freshservice REST API fed Bronze raw data, Silver normalisation and a Gold star schema in Azure Databricks. A materialised Delta table supplied the NLP input. Personal data was masked with regex rules and Microsoft Presidio with Swedish and English spaCy models. Processing stayed inside the organisation, and runs were logged in MLflow. Source tickets are not published here.',
                'Freshservice REST API matade Bronze med rådata, Silver med normalisering och ett stjärnschema i Gold på Azure Databricks. En materialiserad Delta-tabell gav NLP-indata. Personuppgifter maskerades med regexregler och Microsoft Presidio med svenska och engelska spaCy-modeller. Bearbetningen stannade inom organisationen och körningar loggades i MLflow. Källärendena publiceras inte här.',
              )}
            </p>
          </section>
          <section>
            <h3>{l('Text representation', 'Textrepresentation')}</h3>
            <p>
              {l(
                'Five text configurations were compared using paraphrase-multilingual-mpnet-base-v2, with 768-dimensional embeddings for Swedish and English. The selected text_weighted recipe weighted the subject ×3, root-cause analysis ×4 and description ×1, with a 3,000-character limit. A manually built glossary added descriptions for 70 internal terms before embedding.',
                'Fem textkonfigurationer jämfördes med paraphrase-multilingual-mpnet-base-v2, som gav 768-dimensionella inbäddningar för svenska och engelska. Det valda receptet text_weighted viktade ämnet ×3, rotorsaksanalysen ×4 och beskrivningen ×1, med en gräns på 3 000 tecken. En manuellt byggd ordlista lade till beskrivningar för 70 interna termer före inbäddningen.',
              )}
            </p>
            <p>
              {l(
                'The thesis also describes preparing conversation logs, but its final weighted recipe does not list them. Their inclusion in that run cannot be established from the document.',
                'Arbetet beskriver även förberedelse av konversationsloggar, men det slutliga viktade receptet listar dem inte. Dokumentet klargör inte om de ingick i den körningen.',
              )}
            </p>
          </section>
          <section>
            <h3>{l('Reduction and clustering', 'Reduktion och klustring')}</h3>
            <p>
              {l(
                'UMAP used n_neighbors=30 and cosine distance, reducing embeddings to ten dimensions for clustering and two for display. HDBSCAN tested min_cluster_size=10, 20, 30 and 50, with min_samples set to half that value. The selected settings were 30 and 15. The K-means comparison used 73 groups on text_weighted.',
                'UMAP använde n_neighbors=30 och cosinusavstånd och reducerade inbäddningarna till tio dimensioner för klustring och två för visning. HDBSCAN prövade min_cluster_size=10, 20, 30 och 50, med min_samples satt till hälften av värdet. Valda inställningar var 30 och 15. K-means-jämförelsen använde 73 grupper på text_weighted.',
              )}
            </p>
          </section>
          <section>
            <h3>{l('Diagnostic checks', 'Diagnostiska kontroller')}</h3>
            <p>
              {l(
                'Evaluation combined silhouette and Davies-Bouldin with existing problem links. XGBoost was also used as a diagnostic classifier with problem-link status as a proxy label. Its reported metrics conflict within the thesis, so no single performance estimate is presented here. Missing links cannot establish that a ticket has no underlying problem.',
                'Utvärderingen kombinerade silhuett och Davies-Bouldin med befintliga problemkopplingar. XGBoost användes också som diagnostisk klassificerare med problemkoppling som proxyetikett. Dess redovisade mått motsäger varandra i arbetet, så inget entydigt prestandavärde anges här. Saknade länkar kan inte fastställa att ett ärende saknar ett underliggande problem.',
              )}
            </p>
          </section>
          <section>
            <h3>
              {l('Artefacts and next steps', 'Artefakter och nästa steg')}
            </h3>
            <p>
              {l(
                'Masking names with [PERSON] created misleading similarities between unrelated tickets. The thesis also found related themes split across several groups. It proposed removing placeholder tokens before embedding, reviewing and consolidating groups with the IT team, and extending the domain glossary. These are proposed improvements; their effect was not measured in this study.',
                'Maskering av namn med [PERSON] skapade missvisande likheter mellan orelaterade ärenden. Arbetet fann också närliggande teman uppdelade över flera grupper. Det föreslog att ta bort platshållartoken före inbäddning, granska och slå samman grupper med IT-teamet samt utöka domänordlistan. Det är föreslagna förbättringar; deras effekt mättes inte i studien.',
              )}
            </p>
            <p>
              {l(
                'The results describe one organisation. The document leaves some run details and artefact counts unresolved; its tables should not be read as a complete, independently verified experiment log.',
                'Resultaten gäller en organisation. Dokumentet lämnar vissa körningsdetaljer och artefaktantal oklara; tabellerna bör inte läsas som en fullständig, oberoende verifierad experimentlogg.',
              )}
            </p>
          </section>
        </div>
      </ProjectDepth>
    </article>
  )
}

export function HomiePage() {
  return (
    <div className="project-page">
      <Stage
        id="homie-stage"
        level={1}
        kicker={l('Homie API, work in progress', 'Homie API, pågående')}
        title={l(
          'A backend for household events',
          'En backend för hushållets händelser',
        )}
        lead={l(
          'Chore completions are stored as immutable events and aggregated into weekly workload, fairness and cadence. The contract is explicit; several routes are still documented stubs.',
          'Utförda sysslor sparas som oföränderliga händelser och aggregeras till veckobelastning, rättvisa och rytm. Kontraktet är tydligt; flera rutter är fortfarande dokumenterade stubbar.',
        )}
        figure={<HomieFlow />}
        left={
          <>
            <StageBlock title={l('Design', 'Design')}>
              <ol className="stage-steps">
                <li>
                  {l(
                    'Record immutable events',
                    'Spara oföränderliga händelser',
                  )}
                </li>
                <li>
                  {l(
                    'Enrich with household, task, member',
                    'Berika med hushåll, uppgift, medlem',
                  )}
                </li>
                <li>{l('Aggregate in SQL views', 'Aggregera i SQL-vyer')}</li>
                <li>
                  {l(
                    'Serve typed FastAPI contracts',
                    'Servera typade FastAPI-kontrakt',
                  )}
                </li>
              </ol>
            </StageBlock>
            <StageBlock title={l('Status', 'Status')}>
              <StageFacts
                rows={[
                  [l('Implemented route groups', 'Klara ruttgrupper'), '3'],
                  [l('Documented stubs', 'Dokumenterade stubbar'), '4'],
                ]}
              />
              <p>
                {l(
                  'Stub routes return documented previews; no real household data is shown.',
                  'Stubbrutter returnerar dokumenterade förhandsvisningar; ingen riktig hushållsdata visas.',
                )}
              </p>
            </StageBlock>
          </>
        }
        right={
          <>
            <StageBlock title={l('Quality', 'Kvalitet')}>
              <StageTools
                items={[
                  'pytest',
                  'Ruff',
                  'GitHub Actions',
                  'Docker (multi-stage)',
                  'Docker Compose',
                ]}
              />
            </StageBlock>
            <StageBlock title={l('Stack', 'Stack')}>
              <StageTools
                items={[
                  'Python',
                  'FastAPI',
                  'PostgreSQL',
                  'SQLAlchemy',
                  'Alembic',
                  'OpenAPI',
                ]}
              />
            </StageBlock>
          </>
        }
      />
      <div className="reports">
        <ProjectTech project="homie" />
        <ProjectDepth project="homie">
          <HomieProject />
        </ProjectDepth>
      </div>
    </div>
  )
}
