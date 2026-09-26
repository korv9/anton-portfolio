# How distinguishable party language is, by session

Task `polarization` · run `20260926-2115` · gate **passed**

## What the label means

The label is the speaker's party. The measure is how well a classifier separates parties by their words, which is separability, not polarization. Parties can become easier to tell apart because they disagree more, because they talk about different things, or because who does the talking changed.

## Data

- sessions measured: 33
- sessions also measured with KB-BERT: not run: this run used --no-transformers (no GPU)
- TF-IDF and KB-BERT correlation across those sessions: not computed
- passages per session: equal per party, minimum 25 per party to qualify
- per-session AUC range: 0.671 to 0.744
- trend: +0.0016 AUC per session (OLS standard error 0.0003, too small: neighbouring sessions share members and issues)
- speech cards with a party: 254,820 (244,725 issue debates, 10,095 party-leader debates)
- source: Issue and party-leader debates, Swedish Parliament open data
- seeds per session: 3

## Split

Grouped by person (the Riksdag's person id): no member appears in both folds, so the classifier cannot win by recognising an individual. Each session is measured three times with different balanced samples. The headline is the mean over sessions; the per-session range is in Data, not an interval.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Permutation null (shuffled parties) | macro-F1 | 0.126 | — |
| Mean pairwise AUC | AUC | 0.710 | — |

## Gate

Beat the permutation null in 80% of sessions, mean AUC > 0.60.

Outcome: **passed**. 33 of 33 sessions significant; mean AUC 0.710.

## Limitations

- Separability is not polarization. A rising line may mean parties changed subject rather than changed position; topic is not controlled.
- Issue debates dominate the corpus. Who speaks in them follows committee seats, so a party's sample leans towards its committee members' subjects.
- Governing parties are listed per session so the role effect can be read alongside the trend; being in office changes register regardless of position.
- Coverage differs by session. Older sessions have fewer speeches and coarser categorisation, so early points rest on less evidence.
- Equal passages per party removes volume effects but discards data from parties that spoke most.
- No per-speaker output. The measure is defined only in aggregate.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only polarization
```
