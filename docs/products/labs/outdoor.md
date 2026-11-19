# When does the audience arrive? (outdoor)

In digital out-of-home, a media owner sells time on screens, priced by how many people pass. The
`outdoor` subject reads Stockholm's metro stations that way: a station is a screen location, and
a planned station is audience that does not exist yet. The page is `#publiken` (`#outdoor` leads
there), under Labs.

```
python platform/pipeline.py run outdoor                  # fetch, build, test, export
python platform/pipeline.py run outdoor --only publish   # release to R2
python platform/pipeline.py push outdoor                 # the raw files to R2
```

## Sources

| Source | What | Where it comes from |
|---|---|---|
| Region Stockholm, "Fakta om SL och länet" 2013–2022 | Metro boardings per station on an average winter weekday; 2013–2020 also 06–09, 07.30–08.30, 15–18 and 16.30–17.30 | regionstockholm.se for 2019–2022; the Internet Archive's copies of sll.se for 2013–2018. The series ended with the 2022 edition. |
| Trafiklab GTFS Regional, SL (CC0) | Stations, positions, lines, departures per half-hour | The Mobility Database's daily copy (mdb-3237), which needs no key |
| SCB, DeSO (CC0) | Residents 2013–2025, employed residents (by residence) 2020–2024, DeSO 2018 and 2025 boundaries, retail areas 2020 | PxWeb API v1 and SCB's WFS |
| Planned stations and forecasts | 18 stations, 36 forecast statements, a source URL each | `platform/seeds/outdoor/`, compiled by hand from nyatunnelbanan.se, Stockholmsförhandlingen's and Sverigeförhandlingen's agreements and annual reports |

`platform/ingest/outdoor/sl_facts.py` reads the PDFs with PyMuPDF: the appendix table where an
edition has one, the metro map otherwise (and for 2017's T-Centralen and Odenplan, whose appendix
rows are split per line and transfer). A dbt test checks every edition's station sum against the
total it prints (`platform/tests/outdoor/outdoor_printed_totals.sql`).

## Views

1. Stations: boardings per station, and change 2013→2019 and 2019→2022.
2. Hours: an audience index per station and hour (100 = the mean service hour of all stations).
   The four time bands are counted; the shape inside them follows the timetable.
3. Commuter or shopping: the share of a station's day per hour, at stations within 300 m of an
   SCB retail area with at least 500 employees against the rest.
4. New stations: predicted boardings with 80 % jackknife+ intervals.
5. Opening: a range of opening years per branch from how the official forecasts have slipped.

Views 4 and 5 were pre-registered before they were fitted
(`docs/research/preregistrations/outdoor-preregistration.md`); departures are listed in
`outdoor/about.json`. The first fit did not beat the median station by the pre-registered 25 %
(23.7 %), so the page carries the label `not_better_than_median`.

## Limits

Boardings are not unique people, and no price, revenue or screen data is used. The counts are
of a winter weekday; 2020 and 2021 were counted during the pandemic. Open DeSO statistics count
the employed where they live, not where they work. Residents around a planned station are
today's, not the housing planned there, and a new station takes travellers from its neighbours.
