# How distinguishable party language is, by session

Task `polarization` · run `20261101-0304` · gate **passed**

## What the label means

The label is the speaker's party. The measure is how well a classifier separates parties by their words, which is separability, not polarization. Parties can become easier to tell apart because they disagree more, because they talk about different things, or because who does the talking changed.

## Data

- sessions measured: 33
- sessions also measured with KB-BERT: not run: this run used --no-transformers (no GPU)
- TF-IDF and KB-BERT correlation across those sessions: not computed
- passages per session: equal per party, minimum 25 per party to qualify
- per-session AUC range: 0.598 to 0.697
- trend: +0.0007 AUC per session (OLS standard error 0.0005, too small: neighbouring sessions share members and issues)
- same seven parties throughout (S, M, C, L, KD, V, MP): mean AUC 0.635 before 2010/11 and 0.642 from it; trend +0.0002 per session
- same seven parties, compared only within the same debate: mean AUC 0.677 before 2010/11 and 0.717 from it; trend +0.0023 per session
- all parties, same eras: 0.638 before 2010/11 and 0.661 from it
- speech cards with a party: 254,820 (244,725 issue debates, 10,095 party-leader debates)
- source: Issue and party-leader debates, Swedish Parliament open data
- seeds per session: 3
- sessions whose speaker-bootstrap interval lies above 0.5: 33 of 33 (300 resamples, first seed)
- permutation test: 999 shuffles of party between speakers on the first seed's held-out fold, scored with mean pairwise AUC
- code digest: bb42d138b3f9a209
- data digest: f2cdfdcbec3aa3a0
- git commit: ee9e826ed582d4446004dde4ccdde8a2a5210836-dirty

## Split

Party names and abbreviations are masked in the text first, so the label cannot be read off self-references. Grouped by person (the Riksdag's person id): no member appears in both folds, so the classifier cannot win by recognising an individual. Each session is measured three times with different balanced samples. The headline is the mean over sessions; the per-session range is in Data, not an interval.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Permutation null (parties shuffled between speakers) | AUC | 0.499 | — |
| Mean pairwise AUC | AUC | 0.649 | — |

## Gate

Beat the permutation null in 80% of sessions, mean AUC > 0.60. The null shuffles party between speakers since 2026-11-01 (docs/ml-gate-amendments.md); the shuffle of rows it replaced could not fail.

Outcome: **passed**. 33 of 33 sessions under p 0.05, 30 under the Bonferroni limit 0.0015; mean AUC 0.649.

## Limitations

- Separability is not polarization. A rising line may mean parties changed subject rather than changed position. The within-debate measure holds the matter fixed, but not the angle each party takes on it.
- Issue debates dominate the corpus. Who speaks in them follows committee seats, so a party's sample leans towards its committee members' subjects.
- The all-party mean rises when a party with a distinct vocabulary enters (SD from 2010/11, NyD in 1993/94). Read change over time from the seven-party measure, which holds the cast fixed.
- Governing parties are listed per session so the role effect can be read alongside the trend; being in office changes register regardless of position.
- Coverage differs by session. Older sessions have fewer speeches and coarser categorisation, so early points rest on less evidence.
- Equal passages per party removes volume effects but discards data from parties that spoke most.
- Masking removes party names but not other giveaways, such as the names of party leaders or ministers, so some label leakage may remain.
- No per-speaker output. The measure is defined only in aggregate.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only polarization
```
