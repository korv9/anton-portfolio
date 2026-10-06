/**
 * Om datan: how the product is built, from the public sources to this page, what the cleaning
 * left out, and the definitions behind every measure. The portfolio part, kept last so it does
 * not crowd the analysis.
 */
import { l } from '../../i18n'
import { num } from '../controls'
import type { DataQuality, StoryData } from '../analytics/types'
import { MIN_CAST } from '../analytics/metrics'
import { Section } from './parts'
import { ProductQuality } from '../../quality/QualityPanel'

const STEPS: [string, string, string, string][] = [
  [
    'Public sources',
    'Öppna källor',
    'Riksdagen’s open data, SCB, Valmyndigheten',
    'Riksdagens öppna data, SCB, Valmyndigheten',
  ],
  [
    'Python ingestion',
    'Inläsning i Python',
    'Scheduled jobs, checked against contracts',
    'Schemalagda jobb, kontrollerade mot datakontrakt',
  ],
  [
    'Parquet in R2',
    'Parquet i R2',
    'Speeches and roll calls in object storage',
    'Anföranden och voteringar i objektlagring',
  ],
  [
    'dbt + DuckDB',
    'dbt + DuckDB',
    'Tested models: votes, debates, parties',
    'Testade modeller: röster, debatter, partier',
  ],
  [
    'Derived metrics',
    'Härledda mått',
    'Lexicon, tf-idf, member stats (Python); similarity, polarisation (TypeScript)',
    'Ordlista, tf-idf, ledamotsstatistik (Python); likhet, polarisering (TypeScript)',
  ],
  [
    'React',
    'React',
    'This page, from compact JSON',
    'Den här sidan, från kompakt JSON',
  ],
]

export default function OmDatan({
  story,
  quality,
}: {
  story: StoryData
  quality: DataQuality
}) {
  return (
    <Section
      id="om-datan"
      n={9}
      kicker={l('About the data', 'Om datan')}
      question={l('How it works', 'Så fungerar det')}
      deeper={[
        {
          href: '#politik-kallor',
          label: l('Sources and method', 'Källor och metod'),
        },
        { href: '#technical', label: l('The data model', 'Datamodellen') },
        { href: '#status', label: l('Pipeline status', 'Pipelinens status') },
      ]}
    >
      <ol
        className="story-pipeline"
        aria-label={l('The pipeline', 'Pipelinen')}
      >
        {STEPS.map(([en, sv, ten, tsv]) => (
          <li key={en}>
            <b>{l(en, sv)}</b>
            <span>{l(ten, tsv)}</span>
          </li>
        ))}
      </ol>
      <div className="story-two">
        <div>
          <h3>{l('Data quality', 'Datakvalitet')}</h3>
          <ul className="story-quality">
            <li>
              {l('Decision points read', 'Lästa beslutspunkter')}:{' '}
              <b>{num(quality.rows)}</b>
            </li>
            <li>
              {l('Used in the metrics', 'Använda i måtten')}:{' '}
              <b>{num(quality.kept)}</b>
            </li>
            <li>
              {l('Duplicate rows left out', 'Dubbletter utelämnade')}:{' '}
              <b>{num(quality.duplicates)}</b>
            </li>
            <li>
              {l('Without any party position', 'Utan någon partiståndpunkt')}:{' '}
              <b>{num(quality.withoutPositions)}</b>
            </li>
            <li>
              {l(
                `Fewer than ${MIN_CAST} cast votes`,
                `Färre än ${MIN_CAST} avgivna röster`,
              )}
              : <b>{num(quality.fewVotes)}</b>
            </li>
            <li>
              {l('Party rows without a position', 'Partirader utan ståndpunkt')}
              : <b>{num(quality.missingPositions)}</b>
            </li>
            <li>
              {l('Members who changed party', 'Ledamöter som bytt parti')}:{' '}
              <b>{num(story.quality.members_in_more_than_one_party ?? 0)}</b>
            </li>
          </ul>
        </div>
        <div>
          <h3>{l('Definitions', 'Definitioner')}</h3>
          <dl className="story-defs">
            <dt>{l('Party position', 'Partiets ståndpunkt')}</dt>
            <dd>
              {l(
                'The vote most of the party’s members cast in the roll call, as Riksdagen reports it.',
                'Den röst flest av partiets ledamöter lade i voteringen, som Riksdagen redovisar den.',
              )}
            </dd>
            <dt>{l('Cohesion', 'Partisammanhållning')}</dt>
            <dd>
              {l(
                'Cast votes matching the party position, of all the party’s cast votes.',
                'Avgivna röster som stämmer med partiets ståndpunkt, av alla partiets avgivna röster.',
              )}
            </dd>
            <dt>{l('Similarity', 'Röstlikhet')}</dt>
            <dd>
              {l(
                'Of the roll calls where both parties had a position, the share where it was the same.',
                'Av voteringarna där båda partierna hade en ståndpunkt, andelen där den var densamma.',
              )}
            </dd>
            <dt>{l('Polarisation', 'Polarisering')}</dt>
            <dd>
              {l(
                '1 − largest same-position group of members / members of parties with a position; an area’s is the mean of its roll calls.',
                '1 − största gruppen ledamöter med samma ståndpunkt / ledamöter i partier med ståndpunkt; ett områdes värde är snittet av dess voteringar.',
              )}
            </dd>
            <dt>{l('Topic share', 'Ämnesandel')}</dt>
            <dd>
              {l(
                'The learned issue lexicon applied to the words; each topic’s share of the scored words. An estimate: about two thirds of held-out speeches get the right area.',
                'Den inlärda ordlistan tillämpad på orden; varje ämnes andel av de poängsatta orden. En uppskattning: ungefär två tredjedelar av undanhållna anföranden får rätt område.',
              )}
            </dd>
            <dt>{l('Member deviation', 'Avvikelse')}</dt>
            <dd>
              {l(
                'Cast votes that differ from the party’s position, of the cast votes compared. Absence and deviation are not opposition by themselves.',
                'Avgivna röster som skiljer sig från partiets ståndpunkt, av de jämförda avgivna rösterna. Frånvaro och avvikelse är inte opposition i sig.',
              )}
            </dd>
          </dl>
        </div>
      </div>
      <ProductQuality product="politics" />
    </Section>
  )
}
