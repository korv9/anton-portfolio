# Analysing the welfare data

What to use for which purpose, how each measure may be aggregated, and the traps. The model
itself is described in [welfare-data-model.md](welfare-data-model.md).

## Pick the table by purpose

| Purpose | Use | Grain | Why this one |
|---|---|---|---|
| BI dashboards (Power BI, Tableau, Superset) | the star schema: `dim_*` + `fct_*` | one fact per source and grain | BI engines are built for a star; a wide table is slower and less flexible there |
| Metrics that must agree everywhere | the dbt semantic layer (MetricFlow) | `sweden_month`, `county_year` | ratio and stock rules are declared once, so every tool gets the same number |
| Regression, correlation, maps | `mart_county_year_panel` | county x year (+ country) | one row per unit and year, each column already aggregated by its rule, with numerators and denominators |
| Municipal comparison | `mart_municipality_year_panel` | municipality x year | Kolada figures with population and county |
| Time series, forecasting, nowcasting | `mart_national_month` | Sweden x month | seasonally adjusted and raw series, rolling twelve-month flows |
| Cross-country comparison | `mart_ess_country_round` | country or group x ESS round | weighted means per country, pooled Nordic and EU-27 rows |
| Machine learning | `mart_county_year_features` | county x year | lags, changes and gaps to the country, backward-looking only |
| Anything across sources, exploratory | `fct_indicator` | indicator x region x period x sex x age | every headline value on one grain |

Star schema as the core and wide tables as a serving layer on top is the usual division of
labour: the star answers questions nobody has asked yet, the wide tables answer known ones fast.

## Aggregation rules

Every indicator in `dim_indicator` states how it may be combined:

- `measure_type`: `count_flow`, `count_stock`, `rate`, `share`, `mean_score`, `median`
- `time_rule`: `sum`, `mean_of_periods`, `end_of_period`, `recompute_from_components`, `not_aggregable`
- `space_rule`: `sum`, `recompute_from_components`, `population_weighted_mean`, `recompute_from_microdata`, `not_aggregable`
- `components`, `weight_indicator`, `aggregation_note`

The principle is Kimball's: a ratio is non-additive, so store its additive components, sum
those, and divide last. In this model:

| Measure | Over regions, sexes, ages | Over time | Proven by |
|---|---|---|---|
| AKU unemployment rate | sum unemployed and labour force, then divide | mean of monthly levels, then divide | `assert_aku_annual_is_mean_of_months`: within 0.07 points of SCB's published annual rate, 2001-2025 |
| Sjukpenningtal | sum `sick_pay_days` and `insured_persons`, then divide | December (rolling twelve months) | `assert_sick_pay_rate_recomputes_from_components`: counties from municipalities within 0.014 days |
| Started sick-leave cases | sum | sum | `assert_additive_counts_sum_to_country` |
| Ongoing cases, population | sum | never sum: last or mean | |
| Kolada rates | use Kolada's own county and national values | not across years | reported crime: a population-weighted mean of municipalities misses the county value by 15% on average, because crime is counted where it happened |
| Medians (income) | not at all: use published values | | |
| Survey shares (FoHM) | population-weighted mean approximates; prefer published | pooled periods cannot be split or added | |
| ESS means | only from respondents: `pspwght` in a country, `pspwght x pweight` when pooling | not across rounds with different modes | |

Two structural rules:

- **Sum only complete sets.** A sum over parts where some are suppressed (`..` at SCB, `rojd` at
  FK) is a lower bound. AKU county levels add up to the country within 0.4 thousand when all
  21 counties are published, and fall far short when they are not.
- **Facts carry published totals.** `sex_key = 'T'`, `age_group_key` totals such as `15-74`
  and `region_code = '00'` sit beside their parts, because the parts do not always add up. Always
  filter a dimension to one member or to the parts; never sum over a dimension that contains its
  own total. The semantic layer and the panels do this for you.

## The semantic layer

Declared in `platform/models/gold/welfare/serving/schema.yml`, validated in CI with MetricFlow's
own validator (`platform/publish/validate_semantic_layer.py`), time spine `dim_date`.

```bash
pip install "dbt-metricflow[dbt-duckdb]"
cd platform
mf query --metrics unemployment_rate,sick_pay_rate,psychiatric_share_of_started \
         --group-by metric_time__year --start-time 2021-01-01
mf query --metrics county_unemployment_rate,county_sick_pay_rate --group-by county_year__nuts2_code
```

Checked against published figures: `unemployment_rate` for 2024 is 8.37% (SCB: 8.4), for 2025
8.86% (8.8); `sick_pay_rate` for 2024 is 12.33, FK's December value; the county metrics summed
over all counties give 8.40% and 12.33 again.

## Reading the data

The exports are Parquet, one file per table, listed with row counts and column descriptions in
`frontend/public/data/welfare/datasets.json` and served from object storage.

```python
import duckdb
base = "https://<object-storage-base>/parquet/welfare/"   # delivery.json "parquet" base
panel = duckdb.sql(f"select * from '{base}mart_county_year_panel.parquet'").df()
```

Power BI: Get data → Parquet (or Web) per `dim_*` and `fct_*` file, relate on `region_code`,
`period_key`, `sex_key`, `age_group_key`, `indicator_key`; mark `dim_date` as the date table.
Databricks: `spark.read.parquet(...)` per file, or copy them to a volume first.

Locally, after `npm run welfare`, the whole warehouse is `warehouse/portfolio.duckdb`.

## Before you conclude anything

- **Ecological fallacy.** Correlations between counties describe counties. They do not say that
  unemployed people are more often on sick leave, and group-level correlations are usually
  stronger than individual-level ones.
- **21 counties is a small sample.** Weight by population where a county's weight matters,
  report intervals, and prefer changes within counties over time to comparisons across them.
- **Margins.** AKU county rates carry ±1-2 points; FoHM county values have intervals in
  `fct_health_survey`; ESS intervals here ignore the design and are too narrow.
- **Different definitions of the same idea.** AKU unemployment (survey, 15-74) is not Kolada's
  open unemployment (Arbetsförmedlingen register, 18-65). Sjukpenningtal 2.0 (FK) is not 1.0
  (Kolada). Keep them apart.
- **Breaks.** ESS10 in Sweden was self-completed; SCB population from 2025 carries cell-key
  noise; FK suppresses small counts.
- **Lags.** Sources publish months to years after the period. `mart_county_year_features` only
  looks backwards, but a model scored today must still use what was published by then.
