<!-- Generated from the Idea Lineage journal. Do not edit; run npm run ideas:build. -->

# Data decisions

Decisions about data: sources and their terms, selection and units, cleaning and missing values, keys, storage and publication, and model versions where they change how the data reads. The same events as in `DECISIONS.md`, kept to the ones tagged with data.

Each entry shows the steps on record: decided → implemented (a commit, PR or file reference) → verified (a run reference). A later decision that replaces one is linked, and the replaced one moves to *Set aside* with the reason.

## Jobs

- 2026-11-02 · Raw job-ad answers are LOCAL_ONLY, and push refuses to overwrite keys changed in the bucket (`decision-2026-11-03-019`)
  decided (implementation not recorded)

## Philosophy Atlas

- 2026-10-22 · Riksdag moral-foundation shares stay unpublished until the owner's review passes the gate (`decision-2026-11-03-009`)
  The owner labels tmp/mf-review.csv (300 sentence passages); python -m ml.moral.riksdag gate compares the single-rater F1 with the majority-gold English F1 before score may run.
  Why: the English tagger sits only at the human ceiling, so Swedish output needs its own check
  Also: Politics
  decided (implementation not recorded)
- 2026-10-23 · Moral-foundation raw text stays local; only figures and derived features go to R2 (`decision-2026-11-03-010`)
  warehouse/raw/philosophy_moral (MFRC Reddit text, GPL eMFD, ETHICS) and features/philosophy/moral/run are LOCAL_ONLY in warehouse_store.py.
  decided (implementation not recorded)

## Portfolio

- 2026-10-07 · Record why the system changes in an append-only Idea Lineage journal (`decision-2026-10-07-007`)
  Ideas, decisions, experiments, findings and questions are stored as short structured events; prompts and conversations never are.
  Why: Data lineage says where data came from; the reasons behind a change of direction were not written down anywhere.
  decided (implementation not recorded)
- 2026-10-18 · No automatic deployment, and missing data stays absent (`decision-2026-11-03-002`)
  Financial, workforce, contracts, repository and issuer data that cannot be fetched is left out rather than filled in. Named legal findings require human approval before they are shown.
  Also: Compliance
  decided (implementation not recorded)
- 2026-10-20 · SWEDEN has its own delivery group (`decision-2026-11-03-007`)
  configs/delivery/sweden.json; the baseline group excludes sweden/*. The Wellbeing Observatory moved to #wellbeing and old #sweden-* tabs redirect.
  decided (implementation not recorded)
- 2026-10-20 · Library data: Biblioteksdatabasen (open API, no licence named) and bibstat (CC0) (`decision-2026-11-03-008`)
  platform/ingest/kb/libraries.py fetches both; no contact data is stored. Terms used: BemanService01, Besok01, Publ199, Aktiv99.
  decided (implementation not recorded)
- 2026-10-23 · Old Bailey: licensed zip in R2 with attribution, trial text stays local (`decision-2026-11-03-006`)
  The ORDA zip is CC BY-NC 4.0 and is stored in warehouse/raw/oldbailey/ with ATTRIBUTION.txt. Trial text is never published. ml.oldbailey.score refuses to export until all 2,000 gemma answers exist (871 on 2026-10-23, at 6,000 neurons per UTC day).
  decided (implementation not recorded)
- 2026-10-31 · Anything that passes its gate may be shown on Cluster Visuals (`decision-2026-11-03-013`)
  GatedModels lists mlkit targets whose pre-declared gate passed; a card whose gate failed keeps the failure and loses its data file (ml/mlkit/promote.py).
  decided (implementation not recorded)
- 2026-11-01 · Publication refuses a 30 % row drop on files of 100+ rows (`decision-2026-11-03-014`)
  Override with PORTFOLIO_ALLOW_ROW_DROP. A partly missing dbt group blocks, --only publish keeps group completeness, and the heartbeat compares published_at.
  decided (implementation not recorded)
