/**
 * The investigation as it happened, step by step, with the numbers each step produced
 * (research-history.json): the question, the baseline, the book effect it showed, book-centring,
 * the paratext found and cleaned, the expanded corpus (v4), what the clusters follow (validity)
 * and the reading that alone may name a cluster. The emphasis is on book dominance and
 * cross-book structure; cluster-geometry diagnostics live under Method.
 */
import type { ReactNode } from 'react'
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
  // What the paratext audit still flags in the published (book-centred) run.
  const after = history.paratext_clusters.book_centered?.after
  const left = after?.suspected_paratext_clusters ?? 0
  const leftShare = (
    (after?.suspected_paratext_occurrence_share ?? 0) * 100
  ).toLocaleString(l('en-GB', 'sv-SE'), { maximumFractionDigits: 1 })
  const afterNote: [string, string] = !left
    ? [
        'Afterwards no cluster is flagged as paratext.',
        'Efteråt flaggas inget kluster som paratext.',
      ]
    : left === 1
      ? [
          `Afterwards one small cluster (${leftShare} % of passages) is still flagged.`,
          `Efteråt flaggas fortfarande ett litet kluster (${leftShare} % av ställena).`,
        ]
      : [
          `Afterwards ${left} small clusters (${leftShare} % of passages) are still flagged.`,
          `Efteråt flaggas fortfarande ${left} små kluster (${leftShare} % av ställena).`,
        ]
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
      title: [
        'Tightly separated clusters appeared (in UMAP space).',
        'Tätt avgränsade kluster uppstod (i UMAP-rummet).',
      ],
      body: [
        'In the 10-dimensional UMAP space the passages fall into tight, well-separated groups.',
        'I det tiodimensionella UMAP-rummet faller ställena i täta, väl åtskilda grupper.',
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
        `Reading the clusters showed some were glossaries and indexes, not stories (${before?.suspected_paratext_clusters ?? 0} in the book-centred run, ${baselineBefore?.suspected_paratext_clusters ?? 0} in the baseline). Contents, glossaries, indexes, notes and footnotes are now removed before extraction${c ? `: ${c.old_occurrence_count ?? '–'} → ${c.new_occurrence_count} occurrences, ${c.documents_affected} of ${c.documents.length} books changed` : ''}. ${afterNote[0]}`,
        `När klustren lästes visade sig några vara ordlistor och register, inte berättelser (${before?.suspected_paratext_clusters ?? 0} i den bokcentrerade körningen, ${baselineBefore?.suspected_paratext_clusters ?? 0} i utgångsläget). Innehållsförteckningar, ordlistor, register, noter och fotnoter tas nu bort före extraktionen${c ? `: ${c.old_occurrence_count ?? '–'} → ${c.new_occurrence_count} förekomster, ${c.documents_affected} av ${c.documents.length} böcker ändrades` : ''}. ${afterNote[1]}`,
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
        'An audit ranks the clusters worth reading.',
        'En granskning av data rangordnar klustren som är värda att läsa.',
      ],
      body: [
        `${r.candidate_cluster_count} of ${r.cluster_count} clusters pass the audit (spread over books, firm membership, no paratext) and are ranked for reading; ${r.warning_cluster_count} are book-bound or weak and ${r.rejected_by_flags_count} are set aside as too small or paratext. The ranking says what is worth reading, not what anything means.`,
        `${r.candidate_cluster_count} av ${r.cluster_count} kluster klarar granskningen av data (spridda över böcker, stabilt medlemskap, ingen paratext) och rangordnas för läsning; ${r.warning_cluster_count} är bokbundna eller svaga och ${r.rejected_by_flags_count} läggs åt sidan som för små eller paratext. Rangordningen säger vad som är värt att läsa, inte vad något betyder.`,
      ],
    },
    {
      tag: ['Result', 'Resultat'],
      title: [
        'Names come from reading, never from the model.',
        'Namn kommer från läsning, aldrig från modellen.',
      ],
      body: [
        'By design, clusters stay numbered and are shown by their symbol words: a name comes only from reading the passages, never from the model.',
        'Med avsikt förblir klustren numrerade och visas med sina symbolord: ett namn kommer bara från läsning av ställena, aldrig från modellen.',
      ],
    },
  ]
  return (
    <section
      className="atlas-section research report-section ds-container"
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
                  'The clusters were well separated, but they were not measuring the intended construct: they grouped style and translation, not meaning.',
                  'Klustren var väl åtskilda, men de mätte inte det som var avsett: de grupperade stil och översättning, inte betydelse.',
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
                  {centred.book_pairs.mean_similarity[r].pairs.toLocaleString(
                    l('en-GB', 'sv-SE'),
                  )}
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
          'Outside this study: whether a passage uses a word literally (“he drank water”) or symbolically. That needs a hand-labelled sample.',
          'Utanför denna studie: om ett ställe använder ordet bokstavligt (”han drack vatten”) eller symboliskt. Det kräver ett handmärkt urval.',
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
 * The research lesson, in two comparisons that each change one thing. First the corpus (v1, 10
 * books, to v4, 101 books, both baseline); then book-centring within v4 (baseline to
 * book-centred, the same 101 books). Tight clusters in UMAP space (silhouette) and construct
 * validity are different questions: the silhouette drop comes from centring, not the corpus.
 */
function ValidityCase({ history }: { history: ResearchHistory }) {
  const first = history.steps[0]
  const last = history.steps.at(-1)
  const a = first?.metrics
  const b0 = last?.baseline_metrics
  const b = last?.metrics
  if (!first || !last || !a || !b0 || !b || first === last) return null
  const base = history.validity?.experiments.baseline?.association_ami
  const centred = history.validity?.experiments.book_centered?.association_ami
  const row = (name: string, from: string, to: string, reading: string) => (
    <tr key={name}>
      <th scope="row">{name}</th>
      <td className="num">{from}</td>
      <td className="num">{to}</td>
      <td>{reading}</td>
    </tr>
  )
  const table = (from: string, to: string, rows: ReactNode) => (
    <div className="atlas-table-wrap" tabIndex={0}>
      <table className="atlas-table">
        <thead>
          <tr>
            <th scope="col">{l('Question', 'Fråga')}</th>
            <th scope="col" className="num">
              {from}
            </th>
            <th scope="col" className="num">
              {to}
            </th>
            <th scope="col">{l('Reading', 'Tolkning')}</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  )
  const bookShare = l(
    'Validity: share of a cluster from its largest book',
    'Validitet: andel av ett kluster från dess största bok',
  )
  const crossBook = l(
    'Validity: clusters that span several books',
    'Validitet: kluster som spänner över flera böcker',
  )
  const books = (n: number | undefined) =>
    l(`${n ?? '–'} books`, `${n ?? '–'} böcker`)
  return (
    <section className="validity-case" aria-labelledby="validity-case-title">
      <p className="research-tag">{l('The lesson', 'Lärdomen')}</p>
      <h3 id="validity-case-title">
        {l(
          'Tight clusters can still measure the wrong thing',
          'Täta kluster kan fortfarande mäta fel sak',
        )}
      </h3>
      <p>
        {l(
          `The first run (${first.id}) had tightly separated clusters and grouped books, not symbols. A larger corpus spread the clusters over more books; book-centring then loosened them in UMAP space and tied them far less to the book. Whether clusters are tightly separated and whether they measure symbolic meaning are two different questions.`,
          `Den första körningen (${first.id}) hade tätt avgränsade kluster och grupperade böcker, inte symboler. En större korpus spred klustren över fler böcker; bokcentreringen gjorde dem sedan lösare i UMAP-rummet och mycket mindre bundna till boken. Om klustren är tätt avgränsade och om de mäter symbolisk betydelse är två olika frågor.`,
        )}
      </p>
      <h4>
        {l(
          `The corpus: ${first.id} → ${last.id}, both baseline`,
          `Korpusen: ${first.id} → ${last.id}, båda i utgångsläget`,
        )}
      </h4>
      {table(
        `${first.id}, ${books(first.documents ?? 10)}`,
        `${last.id}, ${books(last.documents)}`,
        [
          row(
            bookShare,
            pct(a.mean_largest_book_share),
            pct(b0.mean_largest_book_share),
            l('less book-bound', 'mindre bokbundet'),
          ),
          row(
            crossBook,
            `${a.cross_book_cluster_count} / ${a.clusters}`,
            `${b0.cross_book_cluster_count} / ${b0.clusters}`,
            l('broader', 'bredare'),
          ),
        ],
      )}
      <h4>
        {l(
          `Book-centring: baseline → book-centred, both ${last.id} (${books(last.documents)})`,
          `Bokcentrering: utgångsläge → bokcentrerat, båda ${last.id} (${books(last.documents)})`,
        )}
      </h4>
      {table(l('Baseline', 'Utgångsläge'), l('Book-centred', 'Bokcentrerad'), [
        row(
          l(
            'Cluster separation in the 10-D UMAP space (silhouette; geometry, not quality)',
            'Klusteravgränsning i det tiodimensionella UMAP-rummet (silhuett; geometri, inte kvalitet)',
          ),
          dec2(b0.silhouette),
          dec2(b.silhouette),
          l('looser', 'lösare'),
        ),
        row(
          bookShare,
          pct(b0.mean_largest_book_share),
          pct(b.mean_largest_book_share),
          l('less book-bound', 'mindre bokbundet'),
        ),
        row(
          crossBook,
          `${b0.cross_book_cluster_count} / ${b0.clusters}`,
          `${b.cross_book_cluster_count} / ${b.clusters}`,
          l('broader', 'bredare'),
        ),
        base?.document_id != null &&
          centred?.document_id != null &&
          row(
            l(
              'Validity: how much the clusters follow the book (AMI)',
              'Validitet: hur mycket klustren följer boken (AMI)',
            ),
            dec2(base.document_id),
            dec2(centred.document_id),
            l('less tied to the book', 'mindre bundet till boken'),
          ),
        base?.symbol_id != null &&
          centred?.symbol_id != null &&
          row(
            l(
              'Validity: how much they follow the symbol (AMI)',
              'Validitet: hur mycket de följer symbolen (AMI)',
            ),
            dec2(base.symbol_id),
            dec2(centred.symbol_id),
            l('more tied to the symbol', 'mer bundet till symbolen'),
          ),
      ])}
      <p className="atlas-note">
        {l(
          'Data quality, cluster geometry and construct validity are checked separately.',
          'Datakvalitet, klustergeometri och begreppsvaliditet kontrolleras var för sig.',
        )}
      </p>
    </section>
  )
}
