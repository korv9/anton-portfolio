# Philosophy track 1: pre-registration of two agreement measurements

Written 2026-10-22, before any text was embedded, any classifier was fitted and any model was asked
a question. The commit that adds this file is the record. Any departure is listed in the export's
`method.departures` with the date and the reason.

Both parts measure agreement between a model and human labels. Neither says anything about which
moral view is right, what speakers believe or how moral a party is.

## Sources

| Source | Revision | Licence, checked 2026-10-22 | Use |
| --- | --- | --- | --- |
| Moral Foundations Reddit Corpus (MFRC), `huggingface.co/datasets/USC-MOLA-Lab/MFRC` | `ddc21d2f03e156732fd1ba95a51c4c29f07975be` | CC BY 4.0 (dataset card, "Licensing Information") | training and English test labels |
| Extended Moral Foundations Dictionary (eMFD), `osf.io/vw85e`, file `emfd_scoring.csv` of `github.com/medianeuroscience/emfdscore` | `master` on 2026-10-22, SHA-256 in the export | GPL-3.0 (OSF node licence and the GitHub LICENSE) | English baseline only; the dictionary is read at run time and never redistributed |
| ETHICS, `huggingface.co/datasets/hendrycks/ethics` | `b8b47c589f8bee77175b8648e5497278b68da48a` | MIT (dataset card and the GitHub LICENSE) | test splits for part B |
| Riksdag speeches, `data.riksdagen.se` session archives | the archives listed on the day of the run | open data from Riksdagen | the Swedish paragraphs |

No comment text, scenario text or speech text is published. MFRC comments are written by Reddit
users, so only counts and agreement figures leave the machine.

## Part A: moral-foundation vocabulary in Riksdag speeches

### Labels

- Six foundations from MFRC: care, equality, proportionality, loyalty, authority, purity. "Thin
  morality" and "non-moral" are not tagged on their own.
- Gold label per comment and foundation: present when more than half of the comment's annotators
  chose it (two of three; with two annotators, both).
- Split: 80 % train and 20 % test by the SHA-1 of `20261022:<comment text>`, so a comment is never
  in both.

### Tagger

- Vectors: `@cf/baai/bge-m3` on Workers AI through `platform/nlp/workers_ai.py` (1,024 dimensions,
  cached per text hash), within the free daily quota.
- One logistic regression per foundation (scikit-learn, L2, balanced class weights). C from
  {0.1, 1, 10} by mean F1 over 5 folds of the train split; the decision threshold is the one in
  0.05, 0.10, ..., 0.95 with the highest out-of-fold F1.
- Baseline: eMFD. A comment's score for a foundation is the mean of the dictionary's probability
  over its words found in the dictionary; the threshold is chosen on the train split the same way.
  eMFD has one fairness foundation, so it is compared with equality or proportionality merged, and
  the tagger is scored on the same merged label for that row.

### English agreement and its ceiling

- Primary: F1 of the tagger against the gold label on the test split, per foundation; macro-F1 over
  the six.
- Ceiling: on test comments with at least three annotators, the mean F1 of one annotator against
  another over every ordered pair of annotators who labelled the same comment. The tagger's
  comparable figure is its mean F1 against each single annotator on the same comments.
- Krippendorff's alpha (binary, nominal) among the human annotators per foundation, on the test
  split.

### Swedish check (stop rule)

- Unit: one paragraph of a Riksdag speech (split as `futures_language.speeches` does), 15 to 150
  words. Per speech, the eligible paragraph with the lowest SHA-1 of `20261022:<speech id>:<index>`.
- Sample: per calendar year 1993 to 2026, the 1,500 speeches with the lowest SHA-1 of
  `20261022:<speech id>`. 1993 starts with the 1993/94 session and 2026 ends with the last archive;
  both are labelled partial.
- Review set: the 300 sampled paragraphs with the lowest SHA-1 of `20261022:review:<paragraph id>`,
  written to `tmp/mf-review.csv` with only an id and the text, blind to party, speaker and year.
  The owner labels each paragraph 0 or 1 per foundation with MFRC's definitions, which are copied
  into the sheet's instructions.
- Threshold: the Swedish macro-F1 of the tagger against the owner's labels must be at least 0.8
  times the English test macro-F1. If it is lower, only the method note and the English agreement
  are published, and no Riksdag shares.
- If the threshold is met, a foundation's series is published only when the review set holds at
  least 10 paragraphs the owner marked with it and its Swedish F1 is at least 0.8 times its English
  F1. Other foundations are listed as not validated.
- Until the sheet is labelled, nothing about the Riksdag is published.
- To save quota, the full sample is embedded only after the threshold is met. The review set is
  embedded at once.

### Analysis, if the check passes

- Share: flagged paragraphs over sampled paragraphs, per year and per year and party. Party cells
  need at least 50 paragraphs. 95 % bootstrap interval from 1,000 resamples within each cell.
- Null: within each year, the party labels are shuffled among that year's paragraphs that have a
  party, 999 rounds with seed 20261022. Statistic per foundation: the paragraph-weighted variance of
  party shares around the year's share, summed over years. p = (1 + rounds at or above the
  observed) / 1,000. Holm over the published foundations. Each party cell also gets the 2.5th and
  97.5th percentiles of its shuffled share.
- The yearly series are descriptive. No trend is tested.

### What counts

- A finding: a published foundation whose between-party spread has a Holm-adjusted p below 0.05.
- Not a finding: a single year's spike, a cell under 50 paragraphs, any foundation that failed the
  Swedish check, and any reading of a share as a party's moral position.
- Limits: the tagger learned English Reddit comments and is applied to Swedish parliamentary
  prose; the vectors are multilingual, which is what the Swedish check tests. Shares follow the
  agenda, so a change in a foundation can be a change in topics. One rater labels the Swedish set,
  so no Swedish inter-rater agreement is available. The eMFD baseline is English only; translating
  it would add a second source of error, so it is not applied to Swedish.

## Part B: model agreement with ETHICS labels per theory

- Items: the `test` split of each subset (not `test_hard`). Per subset, the 200 rows with the
  lowest SHA-1 of `20261022:<subset>:<row number>`. Commonsense uses only rows with `is_short`.
- Utilitarianism has no label column: each row lists the more pleasant scenario first. The two are
  shown as A and B, swapped when the hash is odd, and the label is the more pleasant one.
- Model: `@cf/google/gemma-4-26b-a4b-it` on Workers AI, thinking off, temperature 0, at most
  8 output tokens. Every call is written to the Workers AI ledger.
- Two wordings per subset, fixed in `ml/moral/ethics.py` before the first call. Wording 1 asks the
  task as ETHICS states it; wording 2 asks how most people would judge it. The answer is the first
  word of the reply; a reply that matches neither option counts as a disagreement and is counted.
- Per subset and wording: accuracy and Cohen's kappa against the human label; the majority-class
  baseline (always the most common label in the 200, kappa 0); a label-shuffle null of 999
  permutations of the human labels, giving the 95th percentile of kappa and a p-value; a 95 %
  bootstrap interval from 1,000 resamples. Prompt sensitivity is the difference between wordings
  and Cohen's kappa between the two sets of answers.
- A finding: kappa above the null's 95th percentile for a subset in both wordings.
- Not a finding: a ranking of theories. The subsets differ in format (single items, pairs,
  scenario and excuse), so differences between them are described, not tested.
- Limits: the annotators were US crowdworkers; the benchmark is public and may be in the model's
  training data; 200 items per subset gives intervals of roughly ±0.07 in accuracy.

## Changes after registration

None yet.
