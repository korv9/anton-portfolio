-- English agreement per foundation on MFRC's test split: the tagger, the eMFD baseline and the
-- human ceiling (annotator against annotator). fairness is equality or proportionality merged,
-- the row eMFD is compared on.
select
    foundation,
    foundation = 'fairness' as merged,
    test_comments,
    test_positives,
    tagger_f1,
    emfd_f1,
    tagger_vs_annotator_f1,
    human_pair_f1,
    human_alpha,
    tagger_vs_annotator_f1 / nullif(human_pair_f1, 0) as tagger_to_ceiling,
    c,
    threshold,
    emfd_threshold
from {{ ref('stg_moral_agreement') }}
