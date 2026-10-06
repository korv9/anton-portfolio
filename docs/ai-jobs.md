# AI governance in job ads

`#ai-act-jobs` is a view in the EU AI Act Observatory. It asks: **how often do Swedish job ads
talk about AI, AI governance, compliance and model risk, and how does that line up with the AI
Act's milestones?** It counts words in ads. It does not measure demand for skills, and it does
not say that the Act changed hiring.

```
npm run job-ai-governance   # ingest (count every archive), dbt build, publish
```

## Source

Arbetsförmedlingen publishes every ad from its platform in JobTech's historical archives
(`https://data.arbetsformedlingen.se/annonser/historiska/`): one zip per year, and quarters for
the current year. `platform/ingest/jobtech/ingest_governance_terms.py` streams each archive
once and keeps no ads. Per archive it stores four things:

- ads per publication month and occupation field (the denominator);
- ads matching each term;
- a few masked examples per term;
- a manifest with the archive's URL and SHA-256 and the dictionary's SHA-256.

An archive is counted again only if it or the dictionary has changed. A test requires all
archives to have been counted with the same dictionary. Ads that repeat within an archive are
counted once.

A few ads carry impossible publication dates (2051, 2099). Months after the build date are left
out in bronze.

## The dictionary

`seeds/job_ai_governance/job_ai_governance_terms.csv` holds 13 regular expressions, matched in
an ad's headline and description. The page prints them verbatim.

| Family | Terms |
|---|---|
| Context | AI (any mention: upper-case *AI*, *artificiell intelligens*, *maskininlärning* …) |
| The Act | the AI Act by name (*AI Act*, *AI-förordningen*, *AI-akten* …) |
| AI governance | AI governance, responsible / trustworthy AI, AI compliance, AI safety |
| Model operations | model risk, model monitoring, MLOps |
| Data | data governance, privacy and data protection (GDPR …) |
| General | compliance, risk management |

A match means the words are in the ad. It does not mean the job requires them: an ad can name
GDPR in its privacy notice, or name AI as a feature of the employer's product. The page shows
example ads per term so a reader can judge what each pattern catches.

## Data model

| Layer | Model | Grain |
|---|---|---|
| bronze | `stg_job_gov_totals`, `stg_job_gov_terms`, `stg_job_gov_examples`, `stg_job_gov_manifests` | as counted, per archive |
| gold | `mart_job_ai_governance_terms` | month × occupation field (and ALL) × term: mentions, ads, share, 3-month rolling share, year-on-year change in percentage points |
| gold | `mart_job_ai_governance_yearly` | year × field × term |

Every share has its denominator. Rolling and yearly shares are sums over the window, not
averages of monthly shares.

## The view

- One term at a time (`?term=`), as a three-month rolling share of all ads, with the Act's
  milestones as numbered lines. The caveat that temporal overlap does not prove causation sits
  under the chart.
- A table per year with ads, matches and share.
- The occupation fields where the term is most common in the latest year.
- Example ads, and the dictionary with the archives' sizes and hashes.

## Results (6 October 2026)

Eight archives (2020 to 2026-Q2), **4,925,716 ads** from January 2020 to July 2026.

| Share of all ads | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| AI (any mention) | 0.77 % | 0.94 % | 0.80 % | 0.73 % | 1.18 % | 1.97 % | 2.80 % |
| The AI Act by name | 0 | 0 | 1 ad | 3 ads | 0.003 % | 0.016 % | 0.033 % |
| AI governance | 0 | 0 | 0 | 0.001 % | 0.002 % | 0.007 % | 0.016 % |
| Responsible / trustworthy AI | 0.001 % | 0.001 % | 0.001 % | 0.001 % | 0.004 % | 0.014 % | 0.034 % |
| MLOps | 0.003 % | 0.006 % | 0.007 % | 0.006 % | 0.017 % | 0.036 % | 0.056 % |
| Compliance | 0.45 % | 0.51 % | 0.51 % | 0.52 % | 0.83 % | 1.25 % | 1.33 % |
| Privacy and data protection | 2.19 % | 3.21 % | 3.45 % | 3.34 % | 3.73 % | 4.85 % | 5.39 % |

- Mentions of AI were flat at under 1 % of ads until 2023, then rose to 2.8 % in 2026. In 2025,
  11 % of Data/IT ads mentioned AI.
- The Act by name is rare: 1 ad in 2022, 3 in 2023, 25 in 2024, 95 in 2025 and 95 in the first
  seven months of 2026. The governance terms are rarer still and rise from 2024.
- The broad terms (compliance, privacy) rise too. Privacy matches include GDPR notices about
  how the employer handles applications, so their level says little about the job itself.

## Limitations

- Words, not requirements. English and Swedish patterns only.
- *AI* in upper case also matches some unrelated uses (for example, AI as a company name).
  The examples show how often.
- Platform coverage changes over time: the archives hold ads published on Arbetsförmedlingen's
  platform, not the whole labour market.
- The current year is incomplete. Its shares are comparable, but its counts are not.
