# How distinguishable party language is, by session

Task `polarization` · run `20260925-2334` · gate **FAILED**

## What the label means

The label is the speaker's party. The measure is how well a classifier separates parties by their words, which is separability, not polarization. Parties can become easier to tell apart because they disagree more, because they talk about different things, or because who does the talking changed.

## Data

- sessions measured: 29
- sessions also measured with KB-BERT: 5
- TF-IDF and KB-BERT correlation across those sessions: 0.68
- passages per session: equal per party, minimum 25 per party to qualify
- source: Party-leader debates, Swedish Parliament open data
- seeds per session: 3

## Split

Grouped by speaker: no speaker appears in both folds, so the classifier cannot win by recognising an individual. Each session is measured three times with different balanced samples and the spread is reported.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Permutation null (shuffled parties) | macro-F1 | 0.077 | — |
| Mean pairwise AUC | AUC | 0.671 | 0.428 – 0.943 |

## Gate

Beat the permutation null in 80% of sessions, mean AUC > 0.60.

Outcome: **failed**. 

## Limitations

- Separability is not polarization. A rising line may mean parties changed subject rather than changed position.
- Governing parties are listed per session so the role effect can be read alongside the trend; being in office changes register regardless of position.
- Coverage differs by session. Older sessions have fewer speeches and coarser categorisation, so early points rest on less evidence.
- Equal passages per party removes volume effects but discards data from parties that spoke most.
- No per-speaker output. The measure is defined only in aggregate.

## Reproducing

```powershell
python -m mlkit.overnight
```
