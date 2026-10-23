-- English agreement per foundation on MFRC's test split: the tagger, the eMFD baseline and the
-- human ceiling (annotator against annotator). fairness is equality or proportionality merged,
-- the row eMFD is compared on. The intervals resample test comments (ml/moral/mfrc.py ci).
select
    foundation,
    foundation = 'fairness' as merged,
    test_comments,
    test_positives,
    tagger_f1,
    tagger_f1_low,
    tagger_f1_high,
    emfd_f1,
    tagger_vs_annotator_f1,
    human_pair_f1,
    human_alpha,
    tagger_vs_annotator_f1 / nullif(human_pair_f1, 0) as tagger_to_ceiling,
    ceiling_gap,
    ceiling_gap_low,
    ceiling_gap_high,
    c,
    threshold,
    emfd_threshold
from {{ ref('stg_moral_agreement') }}
