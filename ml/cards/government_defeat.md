# Government defeats in Riksdag roll calls, ranked from the agenda item

Task `government_defeat` · run `20261030-2145` · gate **passed**

## What the label means

A roll call where the government took a yes or no position and the chamber voted the other way. It is recorded fact, not a judgement. It says nothing about why the government lost.

## Data

- votes: 22,991
- defeats: 671
- committee reports: 7,331
- sessions: 1993/94 to 2025/26
- defeats per session: 0 to 121; concentrated in minority parliaments
- permutation p-value (200 shuffles): 0.005
- source: Riksdag open data, roll calls as served under parquet/.

## Split

Leave one session out: each session is predicted by a model that never saw it. The headline only compares items within one session, so learning which years were bad earns nothing. Intervals bootstrap committee reports.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Committee prior | within-session AUC | 0.532 | 0.507 – 0.559 |
| Title + committee, TF-IDF LR | pooled AUC | 0.733 | 0.711 – 0.756 |
| Text model minus committee prior | AUC difference | 0.148 | 0.114 – 0.181 |
| Same, directive wording masked | within-session AUC | 0.671 | 0.645 – 0.695 |
| Title + committee, TF-IDF LR | within-session AUC | 0.681 | 0.655 – 0.705 |

## Gate

Within-session AUC of the text model above the committee prior: lower bound of the paired bootstrap difference over reports above zero. Declared before the first run.

Outcome: **passed**. Within-session AUC 0.681 against 0.532 for the committee prior; difference +0.148 (+0.114 to +0.181).

## Limitations

- Titles are written by the Riksdag after the committee has drafted its report, and phrasing such as 'Uppmaning till regeringen' already marks an announcement the committee majority wants. Masking that wording moves the within-session AUC from 0.681 to 0.671, so the title still describes the committee's report, not the floor debate.
- Sessions with a majority government have almost no defeats and add nothing to the ranking. The result describes minority parliaments.
- Each roll call is a point of a report. Points are not independent; the bootstrap resamples reports for that reason.
- Titles before about 2005 are short headings, later ones are full sentences, so text carries different amounts of information across the period.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only government_defeat
```
