# Gate amendments for mlkit models and experiment champions

Dated amendments to how a model or champion is judged. Each is written before the run it
governs. The cards under `ml/cards/` hold the outcomes. Commits record when these words were
saved, but not whether they came before a local run, so every amendment names what was already
known when it was written.

## 2026-11-01: `government_defeat` against title procedure

Already known when this was written: an audit (`tmp/audit/ml/a2.py`) scored two fixed title flags
at within-session AUC 0.663, against 0.681 for the model. `motioner|nej` alone reached 0.614. The
earlier ablation masked 0.681 to 0.671, but its mask left those two words in. No model has been
fitted under this rule.

**Baseline.** Two binary flags read from the title: the earlier directive wording (`bör`, `borde`,
`uppmaning*`, `regeringen*`, `tillkännag*`, `riksdagen`) and `motioner|nej`. Logistic regression on
those two flags, fitted on the training sessions of each leave-one-session-out fold.

**Model judged.** The same TF-IDF logistic regression with committee and substantive flag, on
titles with the extended mask: the directive wording plus `motion*` and `nej`. This is the stricter
reading. The unmasked model already holds the flags' words, so beating the flags with it would not
show that anything except procedure ranks defeats.

**Threshold.** Unchanged: the lower bound of the paired bootstrap difference in within-session AUC,
1,000 resamples of committee reports, seed 0, must be above zero.

**Outcome rule.** A pass updates the card with what the words add beyond procedure. A failure sets
the card to failed, removes the model from Cluster Visuals and keeps the failure in the card.

Reported, not deciding: the unmasked model against the flags, and the masked model against the
flags plus committee and substantive flag.

## 2026-11-01: `polarization` significance test

Already known when this was written: the published run reported 33 of 33 sessions significant. That
test shuffled single rows on fixed predictions, scored macro-F1 and ran 300 shuffles, so every
p-value sat at the floor of 1/301, which is also above a Bonferroni limit of 0.05/33. The mean AUC
of 0.649 and its session range are known.

**Shuffle unit.** Party labels are shuffled between speakers, and each speaker's passages move
together. The audit proposed shuffling within speakers, but a member has one party in a session, so
that shuffle changes nothing and always returns p = 1. A member who changed party in a session
counts as one unit per party.

**Metric.** Mean pairwise AUC, the headline's own metric, with 999 shuffles on the first seed's
held-out fold. The floor is 0.001, below the Bonferroni limit. A speaker bootstrap of the same
metric gives each session an interval, 300 resamples.

**Gate.** Unchanged: p below 0.05 in at least 80% of sessions and mean AUC above 0.60. The Bonferroni
count is reported beside it and does not decide. A failure is treated like any failed gate.

## 2026-11-01: champion decisions

For future decisions only. Published champions and recorded acceptance reports stand.

A candidate's gain is measured on rows both labelings assign, seed by seed, so a method with no
noise is not compared on rows the other left out. The mean gain must exceed the seed spread, the
largest per-seed gain minus the smallest. When several candidates pass, the one with the largest
margin of gain over spread is promoted, instead of the first in the list. `configs/experiments/`
carries the criterion for debates (party) and philosophy (work), as `common_gain`.

## Outcomes, 2026-11-01

`government_defeat`, run `20261101-0258`: **failed**. Masked model 0.646, flags 0.661, difference
-0.015 (-0.041 to +0.010). The unmasked model scored 0.681, +0.019 over the flags (+0.0002 to
+0.038), which did not decide the gate. The masked model also fell below the flags plus committee
and substantive flag, -0.025 (-0.052 to -0.001). The model is off Cluster Visuals and its data file
is deleted. Its failure stays in `ml/cards/government_defeat.md`.

`polarization`, run `20261101-0304`, without KB-BERT: **passed**. 33 of 33 sessions under p 0.05, 30
under the Bonferroni limit of 0.0015, mean AUC 0.649, shuffled-speaker null 0.499. All 33 speaker
bootstrap intervals lie above 0.5.

Debates champion, scored after the fact with five seeds on the shared `sbert-speaker` space
(`tmp/fix/debates_common.py`): K-means lowers party AMI by 0.0010 against HDBSCAN on the 73% of rows
both assign, with a seed spread of 0.0027. Under the new rule K-means would not have been promoted.
The registry is unchanged, because the rule applies to future decisions.
