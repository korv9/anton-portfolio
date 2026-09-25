# Junior share of job adverts, estimated from body text

Task `seniority` · run `20260925-2227` · gate **passed**

## What the label means

The label comes from the existing title-pattern rule: adverts whose title says junior or senior. It is a rule, not ground truth, so the model can at best reproduce that rule's judgement — including its mistakes — on adverts whose titles say nothing.

## Data

- labelled adverts: 17,163
- employers: 1,627
- junior share in labelled data: 21.9%
- junior share in the held-out fold: 28.8%
- unlabelled adverts this could reach: 69,608
- source: JobTech historical archive. Raw text is never published.

## Split

Grouped by employer, 30% held out. No employer appears in both folds, because large employers repost near-identical adverts and a random split would measure template memorisation. Intervals bootstrap over employers.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Majority class | macro-F1 | 0.416 | 0.357 – 0.452 |
| TF-IDF + calibrated LR | AUC | 0.874 | 0.677 – 0.900 |

## Gate

AUC > 0.70, Brier < 0.20, calibrated estimate beats counting.

Outcome: **passed**. 

## Limitations

- The label is a title rule, so this learns to imitate that rule rather than to measure seniority.
- Title text and bare seniority words are stripped from the input. Anything the body says that correlates with a senior title still counts, so some leakage through phrasing is likely and unmeasured.
- Adverts with unspecified titles may differ systematically from labelled ones. Applying the model to them is an extrapolation.
- An advert is not a hire, and the archive may not cover every vacancy.
- Only aggregate shares are published. No employer or advert is identified.

## Reproducing

```powershell
python -m mlkit.overnight
```
