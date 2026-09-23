# RFC drift and budget-language audit — 23 September 2026

Allegoria's engine and unreviewed political-direction examples have been removed from the political law view. `Law & sources` retains the law snapshot browser and source-linked legislative comparisons. Allegoria now has its own compact `#rfc-drift` report, separate from politics.

## Why so many 0% values?

The former SQL joins `raw.words` to `budget_area_keywords` on exact surface-form equality and uses eligible party-leader speeches only. Issue debates are not part of that join. The dictionary has only two or three keywords per expenditure area. Inflection, synonyms, compounds and sparse topic coverage all affect counts. A zero means no detected match; missing data uses a dash. Positive values below 0.1% are now labelled `<0.1%` instead of rounding to zero.

The new reproducible audit reads the exported full text, deduplicates speech IDs within each archive, retains the eight parliamentary parties, and excludes speeches under 20 words. It uses the upstream token pattern and removes soft hyphens, zero-width spaces and STYLEREF artifacts. It does not apply the original model-label stop list. Therefore it is an independently specified lexical baseline, not a claim of bit-identical replication of every historical aggregate.

Observed in 2025/26, across 8 parties × 27 areas:

| Archive | Exact: zero cells | Swedish stemming: zero cells | Exact assigned hits | Stem assigned hits |
| --- | ---: | ---: | ---: | ---: |
| Party-leader debates | 98 / 216 | 74 / 216 | 557 | 1,194 |
| Issue debates | 8 / 216 | 6 / 216 | 18,654 | 36,909 |

This is a coverage/sensitivity comparison, not model-accuracy validation. The larger issue archive and its agenda explain much of the difference. Stemming groups some inflected forms but can merge unrelated words and does not resolve compound words, stance, negation, quotations or references to opponents.

Every budget scatter, share difference, trend and correlation now uses the selected corpus and method. Null-denominator cells are not plotted as zero. Coverage, original dictionary and top eight matched word forms per party can be inspected. The denominator is all area-assigned hits within a party and session, not every word or minute of speech. Sessions include dates after budget submission; these charts cannot establish causal alignment or campaign promise fulfilment.

## A readable budget summary

Eight party cards keep missing proposals visible. Complete proposals show total expenditure frames, net difference from GOV, and the two largest increases and reductions in billion SEK. Clicking an area selects that party and area in the detailed charts. The baseline is the same year's government proposal, not the previous year's spending. These are proposed expenditure frames, not realised spending, tax policy or the complete fiscal balance.

## RFC report

The actual `meaningquality.rfc` reader was run on the stored RFC 2965 and RFC 6265 source snapshots. It extracts 78 and 47 statements respectively; binding-keyword shares are 42.3% and 27.7%. These profiles are descriptive and must not be interpreted as a measured overall loosening. The strict keyword-masked sentence matcher found zero changed pairs, which does not prove no normative change occurred.

A separate explicitly synthetic example holds actor and action fixed while changing MUST → SHOULD, SHOULD → MUST, or MUST → MUST. Results are computed with the actual engine (`loosening`, `tightening`, `neutral`). The report does not use political draft examples or attribute directions to parties.

Limitations: first modal keyword per heuristic sentence; quoted sentences omitted; page/line splitting heuristic; no independent extraction-recall evaluation; no validated alignment of rewritten requirements. Negation, actor, scope and conditions must be preserved when matching real requirements. Optional is labelled optional rather than missing.

Sources: [RFC 2965](https://www.rfc-editor.org/rfc/rfc2965), [RFC 6265](https://www.rfc-editor.org/rfc/rfc6265), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119). Original snapshot hashes are recorded in the report export.

## Next NLP step

The implemented Swedish Snowball stemming is a transparent exploratory baseline. A stronger semantic analysis would chunk speeches into passages, retrieve expenditure-area candidates with multilingual embeddings, and evaluate multi-label assignments on an independently hand-labelled Swedish sample. Keep an unclassified category, report precision/recall by area and party, and separate issue relevance from whether the speaker supports a proposal. Restrict the time window relative to budget submission. Do not claim that more detected matches improve accuracy without this evaluation.

## Reproduce

`python -m pip install snowballstemmer==3.1.1` then `python scripts/build-report-audits.py`. This uses local public snapshots, no model downloads or live API. The workspace installation lives in `.research/nlp`; static exports run without Python. Inputs/outputs are identified in `public/data/reports/manifest.json`.

`npm run build`, `npm run test:e2e`, and with `PYTHONPATH=packages`, `python -m pytest tests/python -q`. Tests cover denominators, observed RFC counts, engine rules, mobile and desktop controls, sources, and automated accessibility.
