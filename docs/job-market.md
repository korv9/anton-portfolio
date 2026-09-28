# The job market

`#job-market` shows every job ad published on Arbetsförmedlingen since 2020, in all
occupations. The IT report on software and data roles, which reads whole ads, is
`#job-market-tech` (see `platform/ingest/jobtech/`).

## Source

Arbetsförmedlingen's historical ads (JobTech), one archive per year and, for the current
year, one per quarter: <https://data.arbetsformedlingen.se/annonser/historiska/>. From 2020
to mid-2026 that is about six million ads and 6 GB of compressed JSON.

## Pipeline

1. **Count** — `platform/ingest/jobtech/ingest_market.py` streams each archive once and keeps
   no ad, only counts, in `warehouse/raw/jobtech/market/`:
   - `ads_<archive>.parquet`: ads and vacancies per publication month, occupation field,
     occupation group (SSYK 4) and workplace county;
   - `conditions_<archive>.parquet`: the same per month and field, by employment type,
     working hours and whether experience is required;
   - `manifest_<archive>.json`: the source URL, SHA-256, size and date of the archive, and
     the ads read.

   An archive is downloaded again only when the server reports a new size or date for it,
   and counted again only when its SHA-256 changed. Downloads are deleted after counting.
2. **Model** — dbt, tag `market` (`platform/models/{bronze,gold}/market`):
   - `stg_market_ads`, `stg_market_conditions`: each archive counts only its own year or
     quarter, so an ad republished across a turn of the year counts once; months before
     2020 and after today are dropped; the 2020–2021 archives' upper-case codes
     (`VANLIG_ANSTALLNING`, `HELTID`) map to the later labels; ads with no county, or
     "Ospecificerad arbetsort", are an unknown county.
   - `dim_market_field`, `dim_market_occupation_group`: latest labels.
   - `mart_market_field_monthly`, `mart_market_occupation_yearly`,
     `mart_market_region_yearly`, `mart_market_conditions_yearly`, `mart_market_archives`.
3. **Export** — `platform/publish/export_market.py` writes `frontend/public/data/jobs/market.json`.
4. **Refresh** — `.github/workflows/refresh-jobs.yml`, monthly, with the counts cached
   between runs.

```
python platform/ingest/jobtech/ingest_market.py
cd platform && dbt build --select tag:market && cd ..
python platform/publish/export_market.py
```

## Reading the numbers

- An ad is not a hire, and one ad can seek several people. Vacancies count an ad without a
  number as one.
- The latest year is partial. Every change on the page compares the same months: the
  months the latest year covers, in that year and the year before.
- Occupation groups are Arbetsförmedlingen's taxonomy (SSYK 2012), in Swedish. A group's
  label and field are those of its latest month.
- Changes per occupation group are shown only where the group had at least 100 ads in the
  months compared.
