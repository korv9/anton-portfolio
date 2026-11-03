<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Philosophy Atlas

## Current direction
warehouse/raw/philosophy_moral (MFRC Reddit text, GPL eMFD, ETHICS) and features/philosophy/moral/run are LOCAL_ONLY in warehouse_store.py.

## Active decisions
- Open the concept layer with Concept Journey — 2026-10-07, `decision-2026-10-07-006`
  Follow one concept at a time through stories, philosophy, Riksdag speeches and the AI Act; the constellation stays as the exploring view.
- Riksdag moral-foundation shares stay unpublished until the owner's review passes the gate — 2026-10-22, `decision-2026-11-03-009`
  The owner labels tmp/mf-review.csv (300 sentence passages); python -m ml.moral.riksdag gate compares the single-rater F1 with the majority-gold English F1 before score may run.
- Moral-foundation raw text stays local; only figures and derived features go to R2 — 2026-10-23, `decision-2026-11-03-010`
  warehouse/raw/philosophy_moral (MFRC Reddit text, GPL eMFD, ETHICS) and features/philosophy/moral/run are LOCAL_ONLY in warehouse_store.py.

## Latest findings
- The foundation tagger reaches macro-F1 0.32 against a human ceiling of 0.27 — 2026-10-23, `finding-2026-11-03-003`
  In-domain random split, one annotator as reference; annotator-vs-annotator 0.27 (alpha 0.08 to 0.31). eMFD baseline 0.04 to 0.22. ETHICS with gemma: kappa 0.50 to 0.84, every subset above the shuffle null.

## Open questions
None recorded.
