# The job market

This pipeline counts every job ad published on Arbetsförmedlingen since 2020, in all
occupations. The Labour Market Observatory page (`#jobb`) was withdrawn on 2026-10-21; its
addresses lead to `#what-does-it-even-mean`, whose job-market posts
(`frontend/src/meaning/posts/job-market-*.tsx`) read `jobs/market.json`. The IT report on
software and data roles, which reads whole ads, is built from `platform/ingest/jobtech/`.

## Source

Arbetsförmedlingen's historical ads (JobTech), one archive per year and, for the current
year, one per quarter: <https://data.arbetsformedlingen.se/annonser/historiska/>. From 2020
to mid-2026 that is about six million ads and 6 GB of compressed JSON.

After the latest archive, ads are counted every morning from JobTech's stream
(<https://jobstream.api.jobtechdev.se>, open, no key), which returns every ad created, changed
or removed in a time window, in the archives' shape.

## Pipeline

1. **Count**: `platform/ingest/jobtech/ingest_market.py` streams each archive once and keeps
   no ad, only counts, in `warehouse/raw/jobtech/market/`:
   - `ads_<archive>.parquet`: ads and vacancies per publication month, occupation field,
     occupation group (SSYK 4) and workplace county;
   - `conditions_<archive>.parquet`: the same per month and field, by employment type,
     working hours and whether experience is required;
   - `manifest_<archive>.json`: the source URL, SHA-256, size and date of the archive, and
     the ads read.

   An archive is downloaded again only when the server reports a new size or date for it,
   and counted again only when its SHA-256 changed. Downloads are deleted after counting.

   `platform/ingest/jobtech/ingest_stream.py` reads the stream from where the previous run
   stopped, in windows of at most a day, and stores under `warehouse/raw/jobtech/`:
   - `stream/raw/<window>.json.gz`: each answer as served, with its provenance line;
   - `stream/ads/<window>.parquet`: the ads first seen in that window, one row each;
   - `stream/state.json`: the first complete day and the time read up to;
   - `market/ads_stream.parquet`, `market/conditions_stream.parquet`: whole months in the
     archives' layout; `market/daily_stream.parquet`: ads per day and field;
     `market/manifest_stream.json`.

   An ad counts once, by the day it was published, the first time it is seen; an ad removed
   later still counts, as in the archives. The stream cannot be read backwards (a past window
   holds only the ads whose last change fell in it, and a removed ad comes back without its
   publication date), so it counts from its first run: the days before are not counted, and a
   month enters the monthly series only when the stream covers it from its first day. The
   months between the latest archive and the stream's first whole month stay empty until their
   quarterly archive is published.
2. **Model**: dbt, tag `market` (`platform/models/{bronze,gold}/market`):
   - `stg_market_ads`, `stg_market_conditions`: each archive counts only its own year or
     quarter, so an ad republished across a turn of the year counts once; the stream
     (archive `stream`) counts only the months after the archives end, so a new quarterly
     archive replaces it for its months; months before 2020 and after today are dropped; the 2020–2021 archives' upper-case codes
     (`VANLIG_ANSTALLNING`, `HELTID`) map to the later labels; ads with no county, or
     "Ospecificerad arbetsort", are an unknown county.
   - `dim_market_field`, `dim_market_occupation_group`: latest labels.
   - `mart_market_field_monthly` (with `preliminary` for stream months),
     `mart_market_occupation_yearly`, `mart_market_region_yearly`,
     `mart_market_conditions_yearly`, `mart_market_archives`, `mart_market_daily` (ads per
     day from the stream). The whole market is in its own models
     (`mart_market_field_monthly_total`, `mart_market_region_yearly_total`,
     `mart_market_conditions_yearly_total`); the export adds it as field `all`.
   - `int_market_periods` (silver): the comparison period ends with the last complete month;
     `mart_market_period` is the same row in gold, for the export.
3. **Export**: `platform/publish/export_market.py` writes `frontend/public/data/jobs/market.json`,
   with `daily` (ads per day) and `preliminary` (months from the stream). The feed's
   job-market posts read the daily series.
4. **Refresh**: `.github/workflows/refresh-jobs.yml`, every morning (04:23 UTC): it restores
   the stored counts, stream and provenance log from R2, counts any new archive and the stream
   since the previous run and rebuilds `market.json` (`pipeline.py run market`). The same run
   refreshes the Job Intelligence files (`job_companies.py refresh`). It stores the raw files back in R2 before it validates the export, then publishes the `jobs` group as a
   versioned release ([delivery-validation.md](delivery-validation.md)). It commits nothing. Quality check `jobs_stream_currentness` warns when the stream's last
   complete day is more than two days old.

```
python platform/ingest/jobtech/ingest_market.py
python platform/ingest/jobtech/ingest_stream.py
cd platform && dbt build --select tag:market && cd ..
python platform/publish/export_market.py
```

## Reading the numbers

- An ad is not a hire, and one ad can seek several people. Vacancies count an ad without a
  number as one.
- The latest year is partial. Every change on the page compares the same months: the
  complete months the latest year covers, in that year and the year before.
- Days and months counted from the stream are preliminary until the quarter's archive is
  published; an ad that was up for less than the time between two runs is missed.
- Occupation groups are Arbetsförmedlingen's taxonomy (SSYK 2012), in Swedish. A group's
  label and field are those of its latest month.
- Changes per occupation group are shown only where the group had at least 100 ads in the
  months compared.
