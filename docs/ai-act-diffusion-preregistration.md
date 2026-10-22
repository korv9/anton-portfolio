# AI Act diffusion clock: pre-registration

Written 2026-10-22, before any term was extracted or counted. It fixes the question, corpora,
term rule, adoption rule and null of H3 (idea I-1, with I-9 alongside) in roadmap item P1.5.
The commit that adds this file is the record. The code comes in later commits, and any
departure from this text is listed in the export's `method` block with its reason.

## Question

After each AI Act milestone, how many months pass before the Act's own vocabulary appears in
Riksdag speeches and in job ads? Which of the two corpora takes a term up first?

## Corpora

The two corpora are never pooled. Each has its own months, denominators, thresholds and nulls.

- Riksdag: every speech in the chamber from Riksdagen's speech archives
  (`int_riksdag_speeches`, from September 2016). The document is one speech, its full text.
- Job ads: every ad in JobTech's historical archives from January 2020, about 2.79 million. The
  document is one ad, its headline and description, with duplicate ad ids counted once as in
  `ingest_governance_terms.py`. The scan runs in GitHub Actions.
- Month: the speech date or the ad's publication month.
- Partial months are excluded. A corpus's first or last month counts only when its records
  cover the month to its first or last day. In practice the last month is dropped because
  each archive ends mid-month.
- 2026 is a partial year. Yearly figures and labels mark it with the months it covers
  (expected: January to September).

## Milestones

The milestones are those of `ai-act/timeline` that fall in or before a corpus's last full month.
Each is tested separately. The milestone month is the month that contains its date. A milestone
needs at least 12 earlier months in a corpus to be tested there, so the Commission's proposal
(April 2021) is tested in both corpora and nothing earlier exists.

## Term extraction

The terms come from the Act's text, not from a hand-picked list.

- Act corpus: the Swedish article texts in `ai-act/article-text-sv` (one document per article).
- Reference corpus: the 209,787 paragraphs of `silver.silver_sfs_corpus_paragraphs` in
  `sfs.duckdb`, Swedish statute law.
- Text is lower-cased. A token is a run of letters or digits, and hyphenated compounds such as
  "ai-system" are one token. N-grams have one to four tokens and do not cross a line break.
- Candidates occur at least 10 times in the Act and in at least 3 articles. No candidate starts
  or ends with a stopword, and no token is only digits.
- Score: weighted log-odds with an informative Dirichlet prior (Monroe, Colaresi and Quinn
  2008). The prior for each n-gram is its pooled count in both corpora. Counts and totals are
  taken per n-gram length. The z-score is δ / √(1 / (y_act + α) + 1 / (y_sfs + α)).
- Candidates with z ≥ 3.29 are ranked by z, and the top 60 go to review.
- Review keeps a term only if it names an AI Act concept. A dropped term gets one of these
  reasons, which are fixed before review:
  - `eu_boilerplate`: EU institutional or legal drafting language that is not about AI
    ("kommissionen", "denna förordning", article references);
  - `fragment`: no meaning on its own;
  - `nested_duplicate`: inside a longer kept candidate with the same count in the Act;
  - `general_language`: a common phrase that is often used outside AI regulation.
- English counterpart (I-9): for each kept Swedish term, the English n-gram of
  `ai-act/article-text-en` (one to five tokens, the same filters) whose counts over the
  articles have the highest cosine with the Swedish term's counts. Review checks each pair. A
  wrong pair loses its English side with the reason `misaligned`.
- The output is `platform/seeds/cross_domain/ai_act_terms.csv`: every reviewed candidate with
  its scores, its decision and, for a dropped term, its reason.

## Matching and shares

- A term matches a document when its tokens occur in order, case-insensitively, separated by
  white space or a hyphen. The last token may take up to four more letters (Swedish
  inflection, "ai-systemet") and must end at a word boundary.
- Swedish and English terms are counted in both corpora.
- Monthly share: documents that contain the term over all documents in the month. Rolling
  share: the sum of matches over the sum of documents for the month and the two before it, as
  in `mart_ai_governance_timeline`.

## Adoption rule

For each corpus, term and milestone:

- Threshold: the 95th percentile (linear interpolation) of the rolling share over all months
  of the corpus before the milestone month. If every earlier value is zero, the threshold is
  zero and adoption means the first month with any match in its window.
- Adoption month: the first month, from the milestone month on, whose rolling share is above
  the threshold.
- Lag: months from the milestone month to the adoption month (0 or more). If no month up to
  the last full month passes, the lag is censored and has no value.

## Placebo null

- 200 placebo months per corpus, term and milestone, drawn with replacement from the months of
  that corpus that have at least 12 earlier months and at least L later months up to the last
  full month, where L is the observed lag. So every placebo date could have shown a lag of L.
- The same rule gives a lag at each placebo month. A censored placebo lag counts as longer
  than any observed one.
- One-sided p = (1 + placebo lags ≤ L) / 201. A censored observed lag gets no p.
- Seed 20261022. Each corpus, term and milestone starts its own generator from the seed and
  its key, so the order of computation does not change a result.
- The export lists every p with the number of tests. No adjustment for multiple tests decides
  anything. The result is descriptive: a lag shorter than at random dates, not an effect of
  the Act.

## I-9, if cheap

- Swedish share of each term pair per corpus and month: Swedish matches over Swedish plus
  English matches, only in months with at least one match.
- The EN–SV cosine per article from the existing bge-m3 vectors, if they are stored. No new
  embedding is made for it.

## What cannot be concluded

That the Act caused a term to spread. Generative AI reached the public in late 2022, and the
Act was negotiated and published at the same time, so many terms rise from 2023 whatever the
milestone. Milestones close together (July and August 2024, July and August 2026) share most
of their windows. A term in an ad shows that the words were written, not that the job requires
compliance work.

## Amendment, 2026-10-22 (after review, after the first Riksdag counts)

Added after the primary analysis had run and its result was known. Nothing above this heading
has changed. The primary list and matching stay as written and are reported in full; the
amended list is reported beside them, never in their place.

Why: review dropped `ai-system`, `ai-modeller`, `ai-modell` and the sandbox terms as
`general_language`. That reason covers common phrases with uses outside AI ("hög risk",
"testning"). An AI-specific compound is not one, so these terms did not fit their own reason.
With them gone, the four kept terms matched one speech in ten years, and the lags rested on that
single match.

What changes, for the amended list only:

- Re-review: the 56 dropped terms of the top 60 are read again against the reason definitions.
  The re-review admits only Act-derived candidates and adds no hand-picked words such as
  "AI-förordningen" or "högrisk". Result: `ai-system` and `ai-modell` come back. `ai-modeller` and
  `ai-modellen` are forms of `ai-modell` and are kept as `nested_duplicate`. `sandlådor`,
  `sandlådan` and every other drop keep their reason. The `amended_*` columns of
  `ai_act_terms.csv` record the result.
- Matching: every token, not only the last, may take up to four more letters, so
  "ai-systemet med högre risk" matches "ai-system med hög risk".
- Precision: for each re-admitted term and language, up to 50 random matched speeches (seed
  20261022) are read by hand. A match counts as on topic if it means the AI concept the
  Act names. An AI sandbox counts; a regulatory sandbox for energy, or a child's sandbox, does not.
  A term stays only at a precision of 0.8 or more. A term that fails gets the reason
  `precision`. Only the counts go to `ai_act_term_precision.csv`, never the speech text.
- Reporting: each lag shows `window_matches`, the matches in its three-month adoption window. A
  lag with 5 or fewer is labelled uninformative, whatever its p, and the diagnostics count those
  lags per list. The adoption rule and the placebo null are unchanged.

Precision in the Riksdag speeches (October 2016 to July 2026; ads follow with the ad scan):

| term | language | matched | read | on topic | precision | decision |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| ai-system | sv | 19 | 19 | 19 | 1.00 | keep |
| ai-modell | sv | 12 | 12 | 12 | 1.00 | keep |
| ai model | en | 11 | 11 | 0 | 0.00 | drop: each match is the Swedish "AI-modeller" |
| sandlådor | sv | 10 | 10 | 3 | 0.30 | drop |
| sandlådan | sv | 25 | 25 | 0 | 0.00 | drop |
| sandbox | en | 1 | 1 | 0 | 0.00 | drop |
| sandboxes | en | 0 | 0 | 0 | – | drop |

The English side of `ai-system` was aligned to "systems", which is wrong, so it stays
`misaligned`.
