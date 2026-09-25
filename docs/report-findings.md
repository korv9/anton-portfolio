# Findings and coverage for the separated reports

The frontend reads the checked-in gold model. No new measurements were inferred from missing party frames or speech data in this change.

## Political budget proposals

`public/data/gold/marts/budget-report.json` contains 1,104 expenditure-area proposal rows in eight parliamentary sessions (2016/17–2025/26). Each proposal amount is the government amount plus a separately reported party deviation, in million SEK. The new budget browser exposes all 27 areas for every imported session and marks incomplete frames. In 2017/18, for example, the government frame has 21 imported areas; neither its total nor a full comparison is shown.

For 2025/26 (budget year 2026), the import has 27 rows each for the collective government frame and the separate proposals from C, MP, S and V. There are no separate M, KD, L or SD frames in that year's FiU1 comparison. The government frame totals 1,543.316 billion SEK. Relative to it, the complete C, MP, S and V proposal totals differ by −5.034, +136.328, +27.227 and +64.959 billion SEK respectively. These are proposed expenditure totals, not actual spending or the complete fiscal balance. The interface derives all figures directly from the selected rows and links to the parliamentary table.

The speech comparison is intentionally separate. It only uses complete, comparable frames. A budget share divides one area's proposed amount by that party's proposed total. The language percentage divides an area's detected word hits by all detected area-word hits in the selected corpus and session. The 2025/26 S health/social-care example is 133.393 billion SEK, 8.4934% of S's proposed total, versus 9 of 81 exact keyword hits (11.1111%) in the selected party-leader corpus. These denominators measure different things. The corpus covers the full session, including speeches after the proposal; a match does not establish support, opposition or causation. Switch to issue debates or Swedish stemming and the language percentage changes.

## Annual accounts

`fact_budget_outturn` contains 783 year-area rows: 27 areas for each year from 1997 through 2025, sourced from Statskontoret's annual outturn aggregate. This is a separate browser of approved budget, reported amendments and recorded expenditure. In 2025 the 27 approved amounts total 1,441.596 billion SEK, recorded expenditure totals 1,402.331 billion SEK, and outturn minus approved is −39.265 billion SEK. This does **not** explain which party proposal prevailed or why actual spending differed. Historical area definitions need review before joining the time series to the FiU1 proposal snapshots.

## Other reports

The job-market snapshot contains 35,726 sampled ads and 2,862 distinct employers for 2022–2025. Ads are not hires, and role/seniority rules are approximations. DrugComb displays saved upstream evaluations; raw training data was not rerun. The Allegoria RFC report remains a limited experiment; its synthetic MUST/SHOULD examples are distinct from measured source profiles. The political UMAP remains an exploratory visual of at most 400 sampled segments per selected session, with unvalidated machine labels. Its embedding and clustering model is slated for retraining; neither two-dimensional distance nor cluster colour encodes political agreement.
