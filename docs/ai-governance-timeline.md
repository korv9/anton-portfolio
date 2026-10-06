# The AI governance timeline (cross-domain)

`#ai-act-signals` is a view in the EU AI Act Observatory. It is the first cross-domain analysis:
it places three domains on **one time axis**:

- the AI Act's milestones, from Cellar;
- how often the Riksdag talks about AI and names the Act (`docs/ai-politics.md`);
- how often job ads use the words (`docs/ai-jobs.md`).

It answers **when** things changed together. It does not answer why.

```
npm run ai-governance-timeline   # dbt build --select tag:cross_domain, then publish
```

It needs the AI Act, Riksdag AI and job-ad governance models built first.

## Data

`gold.mart_ai_governance_timeline` has one row per month and series. Each row keeps:

- numerator and denominator;
- the monthly share;
- a three-month rolling share (sums over the window);
- the gold model it comes from.

The series are defined in `seeds/cross_domain/ai_governance_series.csv`:

| Series | Numerator / denominator | From |
|---|---|---|
| `riksdag_ai` | speeches mentioning AI / all speeches | `mart_ai_politics_monthly` |
| `riksdag_ai_act` | speeches naming the Act / all speeches | `mart_ai_politics_monthly` |
| `jobs_ai_any` | ads mentioning AI / all ads | `mart_job_ai_governance_terms` |
| `jobs_ai_act` | ads naming the Act / all ads | `mart_job_ai_governance_terms` |
| `jobs_ai_governance` | ads mentioning AI governance / all ads | `mart_job_ai_governance_terms` |

Tests check that each series and month appears once, that shares lie between 0 and 1, and that
no numerator exceeds its denominator. The publisher writes `ai-act/signals.json`.

## How it is drawn

Each series has its own panel with its own y-scale. All panels share one x-axis and the same
numbered milestone lines (*small multiples*). There is never a second scale in one chart, and
series are never added together. Their levels differ by orders of magnitude: about 1 % of
speeches mention AI, while a few ads in a hundred thousand name the Act. A shared scale would
flatten all but one series.

Months before a series' data begins are shaded. The job ads start in January 2020 and the
Riksdag in September 2016. A table gives each series per year, with the count beside the share.

## What it can and cannot say

It can say that a series rose or fell in the same period as a milestone. That is
`temporal_overlap` in the concept layer's relation types.

It cannot separate the Act's effect from everything else that happened at the same time. Above
all, generative AI was launched publicly in late 2022, a few months before both the Riksdag and
the job ads begin to rise. The page says so under the panels.

## Results

_Filled in from the complete run; see below._
