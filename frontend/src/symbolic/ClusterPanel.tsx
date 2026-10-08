/**
 * One book-centred cluster, as a reviewer sees it: its review status, how it is spread over
 * books, traditions and symbols, and representative passages from as many books as possible.
 * A semantic label, description and interpretation appear only when a person has reviewed the
 * cluster (reviewed-clusters.json); otherwise it is "Cluster n", and nothing is inferred.
 */
import { l } from '../i18n'
import { share } from '../format'
import { StageBlock, StageFacts } from '../ui/Stage'
import { traditionName } from './AtlasSidebar'
import type { AtlasPoint, ClusterInfo, ReviewedCluster } from './atlasTypes'

const pct = share
const dec = (v: number) =>
  v.toLocaleString(l('en-GB', 'sv-SE'), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const STATUS: Record<ClusterInfo['review_status'], [string, string]> = {
  unreviewed: ['Not reviewed', 'Ej granskat'],
  candidate: ['Picked for review', 'Utvalt för granskning'],
  reviewed: ['Reviewed', 'Granskat'],
  rejected: ['Rejected in review', 'Avfärdat vid granskning'],
}
const AUDIT: Record<ClusterInfo['review_class'], [string, string]> = {
  candidate: ['Cross-book candidate', 'Kandidat över flera böcker'],
  warning: ['Book-bound or weak', 'Bokbundet eller svagt'],
  reject: ['Paratext or too small', 'Paratext eller för litet'],
}
const CONFIDENCE: Record<ReviewedCluster['confidence'], [string, string]> = {
  low: ['low', 'låg'],
  medium: ['medium', 'medel'],
  high: ['high', 'hög'],
}

export function clusterTitle(
  id: number,
  reviewed: ReviewedCluster | undefined,
): string {
  return reviewed
    ? `${reviewed.label}, #${id}`
    : l(`Cluster ${id}`, `Kluster ${id}`)
}

export default function ClusterPanel({
  info,
  reviewed,
  passages,
  onClose,
}: {
  info: ClusterInfo
  reviewed: ReviewedCluster | undefined
  /** Points by occurrence id, for the representative passages' text. */
  passages: Map<string, AtlasPoint>
  onClose: () => void
}) {
  const reps = (
    info.representatives.diverse.length
      ? info.representatives.diverse
      : info.representatives.centroid
  )
    .map((id) => passages.get(id))
    .filter((p): p is AtlasPoint => Boolean(p))
    .slice(0, 6)
  return (
    <>
      <StageBlock title={clusterTitle(info.cluster_id, reviewed)}>
        <p className="cluster-status">
          <span data-status={info.review_status}>
            {l(...STATUS[info.review_status])}
          </span>
          <span data-class={info.review_class}>
            {l(...AUDIT[info.review_class])}
          </span>
        </p>
        {reviewed && (
          <div className="cluster-reviewed">
            <p>{reviewed.description}</p>
            {reviewed.interpretation && (
              <>
                <h4>
                  {l('Why this cluster matters', 'Varför klustret spelar roll')}
                </h4>
                <p>{reviewed.interpretation}</p>
              </>
            )}
            <p className="atlas-note">
              {l('Confidence', 'Säkerhet')}:{' '}
              {l(...CONFIDENCE[reviewed.confidence])}
            </p>
          </div>
        )}
        <StageFacts
          rows={[
            [l('Passages', 'Ställen'), String(info.occurrence_count)],
            [l('Books', 'Böcker'), String(info.book_count)],
            [l('Traditions', 'Traditioner'), String(info.tradition_count)],
            [l('Symbols', 'Symboler'), String(info.symbol_count)],
            [l('Largest book', 'Största bok'), pct(info.largest_book_share)],
            [l('Book entropy', 'Bokentropi'), dec(info.book_entropy)],
            [
              l('Mean membership', 'Medelmedlemskap'),
              dec(info.avg_membership_probability),
            ],
          ]}
        />
        <button type="button" className="cluster-close" onClick={onClose}>
          {l('Show all clusters', 'Visa alla kluster')}
        </button>
      </StageBlock>
      <StageBlock
        title={l('Symbols and traditions', 'Symboler och traditioner')}
      >
        <StageFacts
          rows={[
            ...info.top_symbols.map(
              (s) => [s.symbol_id, pct(s.share)] as [string, string],
            ),
            ...info.top_traditions
              .slice(0, 4)
              .map(
                (t) =>
                  [traditionName(t.tradition), pct(t.share)] as [
                    string,
                    string,
                  ],
              ),
          ]}
        />
      </StageBlock>
      <StageBlock
        title={l(
          'Representative passages, one book at a time',
          'Representativa ställen, en bok i taget',
        )}
      >
        <ol className="cluster-passages">
          {reps.map((p) => (
            <li key={p.occurrence_id}>
              <q>{p.context}</q>
              <small>
                {p.matched_term}, {p.title.split(':')[0]},{' '}
                {traditionName(p.tradition)}
              </small>
            </li>
          ))}
        </ol>
      </StageBlock>
    </>
  )
}
