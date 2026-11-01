# Which Riksdag speeches draw a reply, read from their opening lines

Task `reply` · run `20261030-2145` · gate **FAILED**

## What the label means

A main speech is labelled 1 when the protocol has at least one reply between it and the next main speech. Replies are a right any member can use, so the label records that someone chose to answer, not that the speech was wrong or provocative.

## Data

- main speeches: 37,753
- share drawing a reply: 38.6%
- debates: 4,982
- sessions: 2003/04 to 2025/26
- reply rate, first and fifth speech: 20% and 51%
- permutation p-value (200 shuffles): 0.005
- source: Riksdag protocols, speech cards as served under parquet/.

## Split

Whole debates held out, 25% of speeches; intervals bootstrap debates. Checked again with whole speakers held out and with the last four sessions held out.

## Results

| Model | Metric | Value | 95% CI |
|---|---|---|---|
| Party + position + debate kind | AUC | 0.677 | 0.662 – 0.690 |
| Text minus metadata | AUC difference | 0.016 | 0.008 – 0.024 |
| Text minus metadata, speakers held out | AUC difference | 0.020 | 0.011 – 0.029 |
| Text minus metadata, last four sessions held out | AUC difference | 0.019 | 0.010 – 0.028 |
| Opening text + party + position, TF-IDF LR | AUC | 0.693 | 0.679 – 0.706 |

## Gate

Text and metadata against metadata alone on held-out debates: lower bound of the paired bootstrap AUC difference above 0.01. Declared before the first run.

Outcome: **failed**. AUC 0.693 with text against 0.677 without; difference +0.016 (+0.008 to +0.024).

## Limitations

- Only debates from 2003/04 with at least one reply. Earlier protocols do not mark replies, and a first run that included them and reply-free formats scored AUC 0.88 by recognising era and format. It was discarded.
- Only the opening of each speech is used, about 260 characters. What draws a reply may come later in the speech.
- A reply is attributed to the main speech before it. A member can reply to an earlier speaker, so some labels belong to another speech.
- Speakers are matched on the name in the protocol. The same person can appear under different titles, so the speaker split may leak a few people.
- Debate kind and party describe the setting, not intent. The model says which openings are followed by replies, not why.

## Reproducing

```bash
cd ml && python -m mlkit.overnight --only reply
```
