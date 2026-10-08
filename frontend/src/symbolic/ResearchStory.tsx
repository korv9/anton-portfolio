/**
 * The investigation as it happened, step by step, with the numbers each step produced
 * (research-history.json): the question, the baseline, the book effect it showed, book-centring,
 * the paratext found and cleaned, the expanded corpus (v4), what the clusters follow (validity)
 * and the human review that alone may name a cluster. The
 * emphasis is on book dominance, cross-book structure and review; cluster-quality diagnostics
 * live under Method.
 */
import { l } from '../i18n'
import type { ResearchHistory, StepMetrics, Validity } from './atlasTypes'
import { FindingHero, Interpretation } from '../ui/Story'

const pct = (v: number | null | undefined) =>
  v == null
    ? '–'
    : `${(v * 100).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 0 })} %`

function Metrics({ m }: { m: StepMetrics | null | undefined }) {
  if (!m) return null
  return (
    <dl className="research-metrics">
      <div>
        <dt>{l('Largest book in a cluster', 'Största bok i ett kluster')}</dt>
        <dd>{pct(m.mean_largest_book_share)}</dd>
      </div>
      <div>
        <dt>{l('Cross-book clusters', 'Kluster över flera böcker')}</dt>
        <dd>
          {m.cross_book_cluster_count} / {m.clusters}
        </dd>
      </div>
      <div>
        <dt>{l('Passages in them', 'Ställen i dem')}</dt>
        <dd>{pct(m.cross_book_occurrence_share)}</dd>
      </div>
    </dl>
  )
}

export default function ResearchStory({
  history,
}: {
  history: ResearchHistory
}) {
  const [v1, v2, v3, v4] = history.steps
  const before = history.paratext_clusters.book_centered?.before
  const baselineBefore = history.paratext_clusters.baseline?.before
  const c = history.cleaning
  const r = history.review
  const steps: {
    tag: [string, string]
    title: [string, string]
    body: [string, string]
    metrics?: StepMetrics | null
  }[] = [
    {
      tag: ['Question', 'Fråga'],
      title: [
        'Can symbolic meaning emerge without predefined categories?',
        'Kan symbolisk mening träda fram utan förbestämda kategorier?',
      ],
      body: [
        'Every use of twenty symbol words in ten books is embedded by its surrounding sentences and grouped without labels.',
        'Varje förekomst av tjugo symbolord i tio böcker bäddas in efter meningarna runt den och grupperas utan etiketter.',
      ],
    },
    {
      tag: ['Baseline, v1', 'Utgångsläge, v1'],
      title: ['Strong clusters appeared.', 'Tydliga kluster uppstod.'],
      body: [
        'The embeddings separate the passages into well-defined groups.',
        'Inbäddningarna delar upp ställena i väl avgränsade grupper.',
      ],
      metrics: v1?.metrics,
    },
    {
      tag: ['Problem', 'Problem'],
      title: [
        'The clusters mostly followed books and translators.',
        'Klustren följde mest böcker och översättare.',
      ],
      body: [
        `On average ${pct(v1?.metrics?.mean_largest_book_share)} of a cluster came from a single book: the map grouped style and translation, not meaning.`,
        `I snitt kom ${pct(v1?.metrics?.mean_largest_book_share)} av ett kluster från en enda bok: kartan grupperade stil och översättning, inte betydelse.`,
      ],
    },
    {
      tag: ['Deconfounding, v2', 'Avkoppling, v2'],
      title: [
        'Book-centring reduced book dominance.',
        'Bokcentrering minskade bokdominansen.',
      ],
      body: [
        'Each book’s mean embedding is subtracted, removing what all its passages share.',
        'Varje boks medelinbäddning dras ifrån, så att det alla dess ställen delar försvinner.',
      ],
      metrics: v2?.metrics,
    },
    {
      tag: ['Cleaning, v3', 'Rensning, v3'],
      title: [
        'Paratext was a second confounder (ten-book pilot).',
        'Paratext var en andra störfaktor (pilot med tio böcker).',
      ],
      body: [
        `Reading the clusters showed some were glossaries and indexes, not stories (${before?.suspected_paratext_clusters ?? 0} in the book-centred run, ${baselineBefore?.suspected_paratext_clusters ?? 0} in the baseline). Contents, glossaries, indexes, notes and footnotes are now removed before extraction${c ? `: ${c.old_occurrence_count ?? '–'} → ${c.new_occurrence_count} occurrences, ${c.documents_affected} of ${c.documents.length} books changed` : ''}. Afterwards no cluster reads as paratext.`,
        `När klustren lästes visade sig några vara ordlistor och register, inte berättelser (${before?.suspected_paratext_clusters ?? 0} i den bokcentrerade körningen, ${baselineBefore?.suspected_paratext_clusters ?? 0} i utgångsläget). Innehållsförteckningar, ordlistor, register, noter och fotnoter tas nu bort före extraktionen${c ? `: ${c.old_occurrence_count ?? '–'} → ${c.new_occurrence_count} förekomster, ${c.documents_affected} av ${c.documents.length} böcker ändrades` : ''}. Efteråt läses inget kluster som paratext.`,
      ],
      metrics: v3?.metrics,
    },
    ...(v4?.metrics
      ? [
          {
            tag: ['Corpus expansion, v4', 'Korpusutökning, v4'] as [
              string,
              string,
            ],
            title: [
              `The corpus grew from ${v3?.documents ?? 10} to ${v4.documents ?? '–'} books.`,
              `Korpusen växte från ${v3?.documents ?? 10} till ${v4.documents ?? '–'} böcker.`,
            ] as [string, string],
            body: [
              `Twelve tradition groups, each book checked against its Gutenberg record and the others for duplicated text. Everything else is held fixed: the same twenty symbols, extraction, cleaning, embedding model, UMAP and HDBSCAN; only the sample cap moved from 30 to 15 passages per book and symbol, so no book fills the map. Book-centred, the largest book's share of a cluster went from ${pct(v3?.metrics?.mean_largest_book_share)} to ${pct(v4.metrics.mean_largest_book_share)}, and passages in cross-book clusters from ${pct(v3?.metrics?.cross_book_occurrence_share)} to ${pct(v4.metrics.cross_book_occurrence_share)}.`,
              `Tolv traditionsgrupper, varje bok kontrollerad mot sin post hos Gutenberg och mot de andra för dubblerad text. Allt annat hålls fast: samma tjugo symboler, extraktion, rensning, inbäddningsmodell, UMAP och HDBSCAN; bara urvalstaket ändrades från 30 till 15 ställen per bok och symbol, så att ingen bok fyller kartan. Bokcentrerat gick den största bokens andel av ett kluster från ${pct(v3?.metrics?.mean_largest_book_share)} till ${pct(v4.metrics.mean_largest_book_share)}, och andelen ställen i kluster över flera böcker från ${pct(v3?.metrics?.cross_book_occurrence_share)} till ${pct(v4.metrics.cross_book_occurrence_share)}.`,
            ] as [string, string],
            metrics: v4.metrics,
          },
        ]
      : []),
    {
      tag: ['Review', 'Granskning'],
      title: [
        'Cross-book clusters are read by a person.',
        'Kluster över flera böcker läses av en människa.',
      ],
      body: [
        `${r.candidate_cluster_count} of ${r.cluster_count} clusters pass the audit (spread over books, firm membership, no paratext) and are ranked for review; ${r.warning_cluster_count} are book-bound or weak and ${r.rejected_by_flags_count} are set aside as too small or paratext. The ranking says what is worth reading, not what anything means.`,
        `${r.candidate_cluster_count} av ${r.cluster_count} kluster klarar granskningen av data (spridda över böcker, stabilt medlemskap, ingen paratext) och rangordnas för läsning; ${r.warning_cluster_count} är bokbundna eller svaga och ${r.rejected_by_flags_count} läggs åt sidan som för små eller paratext. Rangordningen säger vad som är värt att läsa, inte vad något betyder.`,
      ],
    },
    {
      tag: ['Result', 'Resultat'],
      title: [
        'Only reviewed clusters receive semantic labels.',
        'Bara granskade kluster får semantiska namn.',
      ],
      body: r.reviewed_cluster_count
        ? [
            `${r.reviewed_cluster_count} clusters have been reviewed and named by a person; every other cluster stays a number.`,
            `${r.reviewed_cluster_count} kluster har granskats och namngetts av en människa; alla andra förblir nummer.`,
          ]
        : [
            'No reviewed semantic clusters yet. Until a person has read the passages, every cluster stays a number.',
            'Inga granskade semantiska kluster ännu. Tills en människa har läst ställena förblir varje kluster ett nummer.',
          ],
    },
  ]
  return (
    <section
      className="atlas-section research ds-container"
      id="symbolic-findings"
      aria-labelledby="symbolic-findings-title"
    >
      <h2 id="symbolic-findings-title">
        {l('How the investigation went', 'Hur undersökningen gick')}
      </h2>
      <ValidityCase history={history} />
      <ol className="research-steps">
        {steps.map((s) =>
          s.tag[0] === 'Problem' && v1?.metrics ? (
            // The book effect is the investigation's strongest moment: a major finding.
            <li key={s.tag[0]} className="research-major">
              <p className="research-tag">{l(...s.tag)}</p>
              <h3>{l(...s.title)}</h3>
              <FindingHero
                value={pct(v1.metrics.mean_largest_book_share)}
                statement={l(
                  'of a baseline cluster came from one book, on average.',
                  'av ett kluster i utgångsläget kom i snitt från en och samma bok.',
                )}
                comparison={l(
                  'The clustering was strong, but it was not measuring the intended construct: it grouped style and translation, not meaning.',
                  'Klustringen var stark, men den mätte inte det som var avsett: den grupperade stil och översättning, inte betydelse.',
                )}
              />
            </li>
          ) : (
            <li key={s.tag[0]}>
              <p className="research-tag">{l(...s.tag)}</p>
              <h3>{l(...s.title)}</h3>
              <p>{l(...s.body)}</p>
              <Metrics m={s.metrics} />
            </li>
          ),
        )}
      </ol>
      <Interpretation
        notMeaning={l(
          'A cluster that spans several books does not prove a universal symbolic meaning; it is a recurring context worth reading, and only a person’s review may name it.',
          'Ett kluster som spänner över flera böcker bevisar inte en universell symbolisk betydelse; det är ett återkommande sammanhang värt att läsa, och bara en människas granskning får namnge det.',
        )}
      >
        <p>
          {l(
            'The negative findings are part of the result. Each version removed one thing the model had been measuring instead of symbols (the book, then the paratext) and tested whether what was left held up in a larger corpus. What survives is smaller than the first map suggested, and more plausible.',
            'De negativa fynden är en del av resultatet. Varje version tog bort en sak som modellen mätte i stället för symboler (boken, sedan paratexten) och prövade om det som återstod höll i en större korpus. Det som överlever är mindre än den första kartan antydde, och mer trovärdigt.',
          )}
        </p>
      </Interpretation>
      {history.validity && <ValidityBlock v={history.validity} />}
    </section>
  )
}

const FACTOR: Record<string, [string, string]> = {
  symbol_id: ['Symbol', 'Symbol'],
  document_id: ['Book', 'Bok'],
  english_voice: [
    'English voice (translator or compiler)',
    'Engelsk röst (översättare eller sammanställare)',
  ],
  tradition: ['Tradition', 'Tradition'],
  genre: ['Genre', 'Genre'],
  source_type: ['Source type', 'Källtyp'],
  period: ['Period', 'Period'],
}
const RELATION: Record<string, [string, string]> = {
  same_english_voice: ['Same English voice', 'Samma engelska röst'],
  same_tradition: ['Same tradition', 'Samma tradition'],
  same_genre: ['Same genre', 'Samma genre'],
  same_source_type: ['Same source type', 'Samma källtyp'],
  same_period: ['Same period', 'Samma period'],
  nothing_shared: ['Nothing shared', 'Inget gemensamt'],
}
const dec = (v: number | undefined) =>
  v == null
    ? '–'
    : v.toLocaleString(l('en-GB', 'sv-SE'), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/** What the clusters follow: association with each property, and similar book pairs. */
function ValidityBlock({ v }: { v: Validity }) {
  const base = v.experiments.baseline
  const centred = v.experiments.book_centered
  if (!base || !centred) return null
  const factors = Object.keys(FACTOR).filter((f) => f in base.association_ami)
  const relations = Object.keys(RELATION).filter(
    (r) => r in centred.book_pairs.mean_similarity,
  )
  return (
    <div className="research-validity" id="symbolic-validity">
      <h3>{l('What the clusters follow', 'Vad klustren följer')}</h3>
      <p>
        {l(
          'Adjusted mutual information between the clusters and each property of a passage: 0 is what chance gives, 1 is identical. A map about symbols would score highest on symbol.',
          'Justerad ömsesidig information mellan klustren och varje egenskap hos ett ställe: 0 är vad slumpen ger, 1 är identiskt. En karta om symboler skulle ge högst värde för symbol.',
        )}
      </p>
      <div className="atlas-table-wrap" tabIndex={0}>
        <table className="atlas-table">
          <thead>
            <tr>
              <th scope="col">{l('Property', 'Egenskap')}</th>
              <th scope="col" className="num">
                {l('Baseline', 'Utgångsläge')}
              </th>
              <th scope="col" className="num">
                {l('Book-centred', 'Bokcentrerad')}
              </th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f}>
                <th scope="row">{l(...FACTOR[f])}</th>
                <td className="num">{dec(base.association_ami[f])}</td>
                <td className="num">{dec(centred.association_ami[f])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {l(
          `Book pairs, book-centred: how alike two books' spread over the clusters is (0–1), averaged by what the two books share. ${centred.book_pairs.books} books with at least ${centred.book_pairs.min_points} clustered passages.`,
          `Bokpar, bokcentrerat: hur lika två böckers fördelning över klustren är (0–1), i snitt efter vad böckerna har gemensamt. ${centred.book_pairs.books} böcker med minst ${centred.book_pairs.min_points} klustrade ställen.`,
        )}
      </p>
      <div className="atlas-table-wrap" tabIndex={0}>
        <table className="atlas-table">
          <thead>
            <tr>
              <th scope="col">{l('Books share', 'Böckerna delar')}</th>
              <th scope="col" className="num">
                {l('Pairs', 'Par')}
              </th>
              <th scope="col" className="num">
                {l('Mean similarity', 'Medellikhet')}
              </th>
            </tr>
          </thead>
          <tbody>
            {relations.map((r) => (
              <tr key={r}>
                <th scope="row">{l(...RELATION[r])}</th>
                <td className="num">
                  {centred.book_pairs.mean_similarity[r].pairs.toLocaleString()}
                </td>
                <td className="num">
                  {dec(centred.book_pairs.mean_similarity[r].mean)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="atlas-note">
        {l(
          'Not measured yet: whether a passage uses a word literally (“he drank water”) or symbolically. That needs a hand-labelled sample.',
          'Inte mätt än: om ett ställe använder ordet bokstavligt (”han drack vatten”) eller symboliskt. Det kräver ett handmärkt urval.',
        )}
      </p>
    </div>
  )
}

const dec2 = (v: number | null | undefined) =>
  v == null
    ? '–'
    : v.toLocaleString(l('en-GB', 'sv-SE'), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

/**
 * The research lesson in one comparison: the first run had the best-separated clusters and
 * measured the wrong thing; the last has weaker clusters and less dependence on the book. Model
 * quality and construct validity are different questions.
 */
function ValidityCase({ history }: { history: ResearchHistory }) {
  const first = history.steps[0]
  const last = history.steps.at(-1)
  const a = first?.metrics
  const b = last?.metrics
  if (!first || !last || !a || !b || first === last) return null
  const base = history.validity?.experiments.baseline?.association_ami
  const centred = history.validity?.experiments.book_centered?.association_ami
  const row = (name: string, from: string, to: string, reading: string) => (
    <tr>
      <th scope="row">{name}</th>
      <td className="num">{from}</td>
      <td className="num">{to}</td>
      <td>{reading}</td>
    </tr>
  )
  return (
    <section className="validity-case" aria-labelledby="validity-case-title">
      <p className="research-tag">{l('The lesson', 'Lärdomen')}</p>
      <h3 id="validity-case-title">
        {l(
          'A good model can still measure the wrong thing',
          'En bra modell kan fortfarande mäta fel sak',
        )}
      </h3>
      <p>
        {l(
          `The first run (${first.id}) had the best-separated clusters and grouped books, not symbols. The latest (${last.id}) has weaker clusters and depends far less on the book. Whether the clusters hold together and whether they measure symbolic meaning are two different questions.`,
          `Den första körningen (${first.id}) hade de tydligast avgränsade klustren och grupperade böcker, inte symboler. Den senaste (${last.id}) har svagare kluster och beror mycket mindre på boken. Om klustren håller ihop och om de mäter symbolisk betydelse är två olika frågor.`,
        )}
      </p>
      <div className="atlas-table-wrap" tabIndex={0}>
        <table className="atlas-table">
          <thead>
            <tr>
              <th scope="col">{l('Question', 'Fråga')}</th>
              <th scope="col" className="num">
                {first.id}
              </th>
              <th scope="col" className="num">
                {last.id}
              </th>
              <th scope="col">{l('Reading', 'Tolkning')}</th>
            </tr>
          </thead>
          <tbody>
            {row(
              l(
                'Model quality: do the clusters hold together? (silhouette)',
                'Modellkvalitet: håller klustren ihop? (silhuett)',
              ),
              dec2(a.silhouette),
              dec2(b.silhouette),
              l('weaker', 'svagare'),
            )}
            {row(
              l(
                'Validity: share of a cluster from its largest book',
                'Validitet: andel av ett kluster från dess största bok',
              ),
              pct(a.mean_largest_book_share),
              pct(b.mean_largest_book_share),
              l('less book-bound', 'mindre bokbundet'),
            )}
            {row(
              l(
                'Validity: clusters that span several books',
                'Validitet: kluster som spänner över flera böcker',
              ),
              `${a.cross_book_cluster_count} / ${a.clusters}`,
              `${b.cross_book_cluster_count} / ${b.clusters}`,
              l('broader', 'bredare'),
            )}
            {base?.document_id != null &&
              centred?.document_id != null &&
              row(
                l(
                  'Validity: how much the clusters follow the book (AMI)',
                  'Validitet: hur mycket klustren följer boken (AMI)',
                ),
                dec2(base.document_id),
                dec2(centred.document_id),
                l('baseline → book-centred', 'utgångsläge → bokcentrerat'),
              )}
            {base?.symbol_id != null &&
              centred?.symbol_id != null &&
              row(
                l(
                  'Validity: how much they follow the symbol (AMI)',
                  'Validitet: hur mycket de följer symbolen (AMI)',
                ),
                dec2(base.symbol_id),
                dec2(centred.symbol_id),
                l('baseline → book-centred', 'utgångsläge → bokcentrerat'),
              )}
          </tbody>
        </table>
      </div>
      <p className="atlas-note">
        {l(
          'Data quality, model quality and construct validity are checked separately.',
          'Datakvalitet, modellkvalitet och begreppsvaliditet kontrolleras var för sig.',
        )}{' '}
        <a href="#quality">
          {l('Quality & Validity', 'Kvalitet och validitet')}
        </a>
      </p>
    </section>
  )
}
