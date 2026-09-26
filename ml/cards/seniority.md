# Junior share of job adverts, estimated from body text

Task `seniority` · run `20260926-2101` · gate **FAILED**

## What the label means

The label comes from the existing title-pattern rule: adverts whose title says junior or senior. It is a rule, not ground truth, so the model can at best reproduce that rule's judgement — including its mistakes — on adverts whose titles say nothing.

## Data

- labelled adverts: 17,166
- employers: 1,628
- junior share in labelled data: 21.9%
- junior share in the held-out fold: 22.2%
- unlabelled adverts this could reach: 69,605
- junior share across employer-grouped splits: 6 splits; calibrated sum closer than counting in 1; mean absolute error 0.057 (largest 0.132) against 0.040 (largest 0.112) for counting
- source: JobTech historical archive. Raw text is never published.

## Split

Grouped by employer, 30% held out. No employer appears in both folds, because large employers repost near-identical adverts and a random split would measure template memorisation. The calibration folds inside the training set are grouped by employer too. Intervals bootstrap over employers.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Majority class | macro-F1 | 0.438 | 0.401 – 0.463 |
| TF-IDF + calibrated LR, threshold 0.5 | macro-F1 | 0.823 | 0.736 – 0.879 |
| TF-IDF + calibrated LR | Brier | 0.088 | — |
| TF-IDF + calibrated LR | AUC | 0.904 | 0.833 – 0.946 |

## Gate

AUC > 0.70, Brier < 0.20, calibrated estimate beats counting.

Outcome: **failed**. AUC 0.904, Brier 0.088; estimated junior share 0.244 against observed 0.222, counting hard predictions gives 0.206.

## Limitations

- The label is a title rule, so this learns to imitate that rule rather than to measure seniority.
- Title text and bare seniority words are stripped from the input. Anything the body says that correlates with a senior title still counts, so some leakage through phrasing is likely and unmeasured.
- Adverts with unspecified titles may differ systematically from labelled ones. Applying the model to them is an extrapolation.
- The model ranks adverts well, but its junior share for employers it has not seen can miss by more than ten points, and summing calibrated probabilities does not reliably beat counting hard predictions (see Data). Calibration learnt on some employers does not carry to others, so the share among unspecified adverts is not supported until it does.
- An advert is not a hire, and the archive may not cover every vacancy.
- Only aggregate shares are published. No employer or advert is identified.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only seniority
```
