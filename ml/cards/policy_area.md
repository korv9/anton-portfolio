# Policy area of a debate passage, learned from committee labels

Task `policy_area` · run `20260925-2230` · gate **FAILED**

## What the label means

The label is the Riksdag committee that handled the matter, taken from the decision point whose title matches the debate section. Committee is a proxy for policy area, not the thing itself: a committee's remit is administrative and can span several areas, and one area can be split across committees. A section whose title matches two committees is excluded rather than resolved.

## Data

- training passages: 19,559
- holdout passages: 5,675 (session 2025/26)
- committees: 16
- debate sections: 1,305
- source: Issue-debate speeches, Swedish Parliament open data

## Split

Temporal: trained on every session before 2025/26, tested on 2025/26. Asserted that no debate section appears on both sides. Intervals are a cluster bootstrap over debate sections, because speeches within a debate are not independent.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Majority class | macro-F1 | 0.008 | 0.004 – 0.012 |
| TF-IDF + LR | macro-F1 | 0.628 | 0.592 – 0.677 |
| KB-BERT | macro-F1 | 0.668 | 0.629 – 0.724 |

## Gate

KB-BERT must exceed TF-IDF by more than the width of the TF-IDF 95% interval.

Outcome: **failed**. 

## Limitations

- Committee is a proxy for policy area, not a measurement of it.
- The existing keyword methods predict expenditure area, a different label space, so they are not comparable baselines and are not reported here.
- Applying this to party-leader debates is a transfer to a different genre. Party-leader speeches are broader and less tied to one matter, and the error of that transfer is not measured by this holdout.
- 77% of debate sections match a decision point. The rest are excluded, and whether they differ systematically is unknown.
- Output is aggregate shares per session and party. No per-speaker claim is supported or published.

## Reproducing

```powershell
python -m mlkit.overnight
```
