# Old Bailey extraction: pre-registration

Written 2026-10-22, before any trial was sampled, sent to a model or scored. The commit that
adds this file is the record. Code and results come in later commits. Any departure from this
text is listed in the export's `method.amendments` with its date and reason.

## Question

The Old Bailey Online project hand-tagged every trial's offence, verdict and punishment. If a
small open model reads the same trial text, how often does it give the clerk's category? How
does it compare with two cheap baselines, and does its accuracy change across 240 years of
printing and spelling?

This is a measurement of extraction agreement with one set of hand tags. It says nothing about
crime, justice or the people tried.

## Data

- Source: Old Bailey Online XML Data, version 7.2, doi:10.15131/shef.data.4775434.v2
  (University of Sheffield ORDA), licence CC BY-NC 4.0. Only the Proceedings files are used,
  not the Ordinary's Accounts.
- Unit: one `div1 type="trialAccount"`.
- Eligible trials have exactly one defendant, one offence and one verdict, joined by a single
  `criminalCharge`. Trials with several defendants or charges are left out, because their
  labels need per-person alignment that a single answer cannot express. The share left out is
  reported.
- Gold labels are the project's top-level categories:
  - offence: 9 categories (`breakingPeace`, `damage`, `deception`, `kill`, `miscellaneous`,
    `royalOffences`, `sexual`, `theft`, `violentTheft`);
  - verdict: 4 categories (`guilty`, `notGuilty`, `specialVerdict`, `miscVerdict`);
  - punishment: 6 categories (`death`, `transport`, `imprison`, `corporal`, `miscPunish`,
    `noPunish`), plus `none` for a not-guilty trial with no punishment tagged.
- Punishment is scored only where the answer is in the text the model sees: a punishment tagged
  inside the trial account, or `none` after a not-guilty verdict. In part of the 18th century
  sentences were printed in a separate summary after the trials. Guilty trials whose sentence
  sits only there are left out of the punishment score, and their count is reported.
- Model input: the trial account's text with all tags removed and white space collapsed. A trial
  over 1,500 words keeps its first 750 and last 750 words with `[...]` between them, so that the
  indictment and the outcome both stay in.

## Sample

- 2,000 trials, 500 from each period: 1674-1749, 1750-1799, 1800-1849, 1850-1913. Equal strata
  make early, noisier text visible instead of letting the many 19th-century trials dominate.
- Seed 20261022, simple random sampling within each stratum.
- A separate development set of 200 eligible trials (50 per period, seed 20261023) is drawn
  outside the sample. The keyword rules and the prompt may be adjusted on it only. The sample is
  scored once, after both are frozen.

## Methods

1. Majority class: the most common category of each field among eligible trials outside the
   sample and the development set.
2. Keyword rules: ordered regular expressions per category, written from the category
   definitions and checked on the development set. Unmatched trials get the majority class.
3. gemma: `@cf/google/gemma-4-26b-a4b-it` on Cloudflare Workers AI, thinking off, temperature 0,
   at most 80 output tokens. The prompt lists the allowed labels with one line on each and asks
   for one JSON object `{"offence", "verdict", "punishment"}`. An answer that is not valid JSON,
   or has a label outside the list, counts as wrong for that field and is reported as invalid.
   One call per trial, no retries on content.

## Budget

Every call is logged with its tokens and neurons in `warehouse/cluster_lab/workers_ai_ledger.jsonl`.
A day's run stops at 6,000 neurons by that ledger, below the free 10,000 neurons, which leaves
room for other work on the account. Expected cost is 7 to 10 neurons per trial, so the sample
takes two or three days. Results are written per trial, so an interrupted run resumes.

## Scores

- Per field and method: accuracy and macro-F1, with 95 % intervals from 1,000 bootstrap
  resamples of trials (seed 1).
- gemma against keyword rules: the paired bootstrap difference in accuracy per field. A
  difference is reported as a difference only when its 95 % interval excludes zero.
- Accuracy per field and period, with counts, for each method.
- Confusion matrices of gold against predicted category for gemma and for the keyword rules.
- Invalid answers and left-out trials, with counts and reasons.

Expected before running: verdict is close to the ceiling for both the rules and the model,
because the text usually says "Guilty" or "Not Guilty". Offence is the hardest field, since
categories such as `deception` and `royalOffences` (coining) depend on legal reading. These
expectations are written down so the results can be checked against them, not as hypotheses
with a pass mark.

## Publication

Only counts, scores and confusion matrices are published. No trial text, no names and no
per-trial predictions go to the site. The raw zip is stored in the R2 bucket next to its licence
and attribution file, as CC BY-NC 4.0 allows non-commercial redistribution with attribution.

## Limits

- The gold labels are one project's reading, made with automated markup and manual correction.
  Disagreement is not always a model error.
- Single-defendant, single-charge trials are simpler than the excluded ones, so the scores do
  not carry over to the whole Proceedings.
- The text is the project's keyed transcription of the printed Proceedings. Period differences
  may reflect language and the format of the reports as much as transcription quality.
