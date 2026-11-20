# Government defeats in Riksdag roll calls, ranked from the agenda item

Task `government_defeat` · run `20261101-0258` · gate **FAILED**

## What the label means

A roll call where the government took a yes or no position and the chamber voted the other way. It is recorded fact, not a judgement. It says nothing about why the government lost.

## Data

- votes: 22,991
- defeats: 671
- committee reports: 7,331
- sessions: 1993/94 to 2025/26
- defeats per session: 0 to 121; concentrated in minority parliaments
- permutation p-value (200 shuffles of single rows, floor 0.005; rows are not independent and this does not decide the gate): 0.005
- source: Riksdag open data, roll calls as served under parquet/.
- code digest: bd5d0d39fe8f796f
- data digest: 14ccda960c6f34be
- git commit: ee9e826ed582d4446004dde4ccdde8a2a5210836-dirty

## Split

Leave one session out: each session is predicted by a model that never saw it, but that model does train on later sessions, so this is not a forecast. The headline only compares items within one session, so learning which years were bad earns nothing. Intervals bootstrap committee reports.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Two title-procedure flags | within-session AUC | 0.661 | 0.642 – 0.681 |
| Committee prior | within-session AUC | 0.532 | 0.507 – 0.559 |
| Title + committee, nothing masked | within-session AUC | 0.681 | 0.655 – 0.705 |
| Masked model minus flags | AUC difference | -0.015 | -0.041 – 0.010 |
| Unmasked model minus flags | AUC difference | 0.019 | 0.000 – 0.038 |
| Flags + committee + substantive | within-session AUC | 0.671 | 0.649 – 0.695 |
| Masked model minus flags + committee + substantive | AUC difference | -0.025 | -0.052 – -0.001 |
| Masked model | pooled AUC | 0.673 | 0.649 – 0.698 |
| Title words, procedure masked, + committee, TF-IDF LR | within-session AUC | 0.646 | 0.620 – 0.672 |

## Gate

Within-session AUC of the text model with procedure words masked, above a baseline of two binary title-procedure flags: lower bound of the paired bootstrap difference over reports above zero. Amended 2026-11-01 (docs/research/ml-gate-amendments.md), knowing that fixed flags scored 0.663 against the unmasked model's 0.681. The first gate, the unmasked model against the committee prior, passed at 0.681 against 0.532 in run 20261030-2145.

Outcome: **failed**. Within-session AUC 0.646 with procedure words masked, against 0.661 for the flags; difference -0.015 (-0.041 to +0.010).

## Limitations

- The gate failed, so this model is not shown on Cluster Visuals. The first gate's pass does not stand against the harder baseline.
- Titles are written by the Riksdag after the committee has drafted its report, and phrasing such as 'Uppmaning till regeringen' already marks an announcement the committee majority wants. Two binary flags for that wording and for 'motioner' or 'nej' reach 0.661 on their own.
- The mask removes the words the audit named. Other procedural wording may remain, so the masked score is an upper bound on what the subject carries.
- The flags were picked after an audit had seen them score well on all sessions, which favours the baseline. Their weights are still fitted per fold.
- Sessions with a majority government have almost no defeats and add nothing to the ranking. The result describes minority parliaments.
- Each roll call is a point of a report. Points are not independent; the bootstrap resamples reports for that reason.
- Titles before about 2005 are short headings, later ones are full sentences, so text carries different amounts of information across the period.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only government_defeat
```
