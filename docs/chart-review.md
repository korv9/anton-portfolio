# Chart review

Reviewed the frontend chart families and their uses across the project. The supplied
reference is a guide to matching chart type to question, not a requirement to use
every chart type. Existing source data and model results are unchanged.

| Area | Question and choice | Decision |
| --- | --- | --- |
| Politics / current seats | Composition of parliament, majority threshold | Keep labelled stacked seats and seat counts. |
| Polls, elections, party profiles, speeches, parliamentary studies | Change over time | Keep dated lines, party identity and published uncertainty bands. |
| Votes | Composition and pairwise agreement | Keep stacked vote shares and labelled agreement matrix; unclassified positions remain explicit. |
| Budget | Compare amounts, signed deviations, patterns across areas and time | Keep paired/diverging bars, heatmap and trend lines; incomplete imports remain excluded where required. |
| Taxes | Compare countries/municipalities and development over time | Keep ranked horizontal bars and time series, with units and reference values. |
| Welfare / How is Sweden doing? | Trends and regional comparisons | Keep multi-series lines, uncertainty and data tables with embedded bars. |
| Analysis | Relationships between two measures | Keep scatter plots; no added bubble area without a meaningful third measure. |
| Jobs / monthly ads | Changes over calendar time | Correct the single-series chart to sort dates and use elapsed time, not row index. Include negative observations if supplied and omit invalid points. Keyboard-labelled points retained. |
| Jobs / technologies | Compare category shares | Sort descending; use a consistent 0–100% scale. Technologies overlap, so do not stack to 100%. |
| Job clusters | Semantic structure versus group size | Keep UMAP; add sorted, clickable count bars. Counts cover all years, noise is separate and grey. Map area is not a count encoding. |
| Allegoria / RFC | Composition of extracted statements | Replace separate percentage bars with one 100% stack per document. Segment weights use exact counts, with visible percentages and counts alongside. |
| DrugComb | Model evaluation, cleaning counts, lineage shares | Keep comparable bars, explicit missing correlation and fixed share scales. No synthetic performance curves added. |
| Thesis / Homie | Explain workflow and project evidence | Keep documented workflow/content; no quantitative chart invented from unavailable internal records. |
| Home circle and project previews | Navigation and preview | Circle remains navigation, not a proficiency/radar score. Previews remain grounded in existing project data or labelled method illustrations. |

Validation: production build; chart-specific browser checks for actual date spacing,
composition denominators and cluster selection; existing responsive, accessibility
and project navigation checks. The source review does not imply every dataset has
been independently revalidated against its external publisher.
