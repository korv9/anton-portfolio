# Dooh: pre-registration of the audience at opening

Written 2026-11-19, after the two predictions in `outdoor-preregistration.md` were published and
before anything below was computed. It adds a third prediction to the `dooh` subject: the audience
around each planned station in the year it is likely to open, instead of among today's residents.
The commit that adds this file is the record; any departure is listed in the export's
`departures` with its reason.

## Why

Prediction 1 places each planned station among the people who live around it today. The stations
are built where housing is planned (Barkarbystaden, Hagastaden, Sicklaön, Årstafältet), so the
audience at opening is the more useful number for a media owner. Newer boardings do not exist:
Region Stockholm's last per-station count is the 2022 edition of "Fakta om SL och länet", and the
series ends in 2026 (statistikrapporter page, checked 2026-11-19).

## Data

- Region Stockholm, Befolkningsprognos 2026, data för planområden: residents per planning area
  and year, 2025–2035 (summed over age and sex). Source:
  https://www.regionstockholm.se/4a4528/contentassets/aa74275c617c4ba4b7b1404a60d4a2c5/data-for-planomraden-prognos-2026.xlsx
- Region Stockholm publishes no boundaries for planning areas. Each new planned station is linked
  by hand to the one or two planning areas that hold most of its 1,000 m circle, in a seed with a
  reason per row, written before the growth figures are read. With two areas their sums are used.
- Everything else as in prediction 1: SCB DeSO residents and employed residents within 1,000 m,
  retail areas, distance to T-Centralen, interchange routes, terminal.

## 3. Audience at opening

- Opening year per branch: the median of prediction 2 (`timing.json`, `range.p50`), rounded down
  to a whole year, and capped at 2035, the last projected year. A capped branch is flagged.
  Sensitivity, stated now: the latest official forecast year instead of the median.
- Growth: g = projected residents of the station's planning area(s) in the opening year over the
  same in 2025.
- Potential reach: residents within 1,000 m (SCB, latest year) × g. Employed residents within
  1,000 m × g, assuming the employed share stays as it is.
- Boardings at opening: prediction 1's fitted model, not refitted, evaluated with the residents and
  employed-residents features multiplied by g; all other features unchanged. Interval: the same
  80 % jackknife+ from the 100 leave-one-out fits. The label is prediction 1's label: the model is
  not re-checked, since no opening year has been observed.
- Published per new station: opening year used, g, potential reach today and at opening,
  boardings today and at opening with intervals, and the sensitivity.
- Interchange platforms are not predicted, as in prediction 1.

## What cannot be concluded

- The local pace of building: inside Stockholm a planning area is a whole district, so a station
  in a fast-growing corner (Slakthusområdet, Årstafältet) gets its district's average growth.
- Jobs: no official employment projection exists below the region, so workplaces and retail stay
  as today.
- Ramp-up after opening, travel that moves from nearby stations, and unique people. Potential reach
  counts residents who live near the station, not people who see a screen.
