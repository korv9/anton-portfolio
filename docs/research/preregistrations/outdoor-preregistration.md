# Outdoor: pre-registration of the two predictions

Written 2026-11-19, before either model was fitted. It fixes the question, data, method, seed,
check and limits of the two predictions in the `outdoor` subject ("När kommer publiken fram?").
The commit that adds this file is the record: the code that fits them comes in a later commit,
and any departure from this text is listed in the export's `method` block with its reason.

Shared by both:

- Seed 20261119. Each prediction starts its own generator from it.
- "Now" is the date the feed of planned openings was last checked, stored with the data.
- Nothing is read from published JSON; inputs are the gold models of the subject.
- A boarding is one person boarding one metro train at one station on an average winter weekday,
  as counted by hand by Region Stockholm. Boardings are not unique people: a person who travels
  out and back boards twice, and a change of train or from a bus counts as a new boarding (SL's
  average trip had 1.61 boardings in 2021). No price, ad-revenue or screen data is used.

## 1. New inventory: boardings at the planned stations

- Question: how many boardings per average winter weekday would each planned metro station have,
  if it opened among the people who live around it today?
- Unit: the 100 metro stations in the 2022 edition of "Fakta om SL och länet" (a station with
  several lines is one station). Planned stations that add platforms to an existing station
  (an interchange) are not predicted; they are listed with the existing station's count.
- Target: log of the station's 2022 boardings (the latest published year). Sensitivity, stated
  now: the same fit on 2019, the last year before the pandemic.
- Features, all from open data and computed the same way for existing and planned stations:
  1. log residents within 1,000 m of the station (SCB DeSO 2025, area-weighted: a DeSO counts
     with the share of its area inside the circle), the target year's figures for training and
     the latest year's for the planned stations;
  2. log employed residents (15–74, counted where they live) within 1,000 m, same weighting,
     2022 for training and the latest year for the planned stations;
  3. log(1 + employees in SCB retail areas, handelsområden 2020) within 1,000 m, area-weighted;
  4. log distance in km to T-Centralen;
  5. the number of distinct commuter-rail, tram and light-rail routes in today's GTFS with a
     stop within 400 m;
  6. whether the station ends a line (a terminal), 0 or 1. For planned stations, from the
     sourced plan.
  Station positions: GTFS parent stations for existing ones, the sourced coordinates for planned
  ones. No feature is chosen or dropped after seeing the fit.
- Model: ordinary least squares on the six features with an intercept.
- Interval: 80 % jackknife+ prediction interval from the 100 leave-one-out fits.
- Check, pre-stated: leave-one-out median absolute error in log units, against the null model
  that predicts the median of the other 99 stations; and the share of stations whose observed
  value falls inside its own jackknife+ interval computed without it (coverage).
- Decision rule: the predictions are labelled `model` if the model's leave-one-out median absolute
  error is at least 25 % below the null model's and coverage lies between 0.70 and 0.90;
  otherwise `not_better_than_median`, published with that label beside the numbers.
- What cannot be concluded: the audience once the planned housing and offices are built
  (Barkarbystaden, Hagastaden, Arenastaden and Nacka grow after this count); boardings that
  move from nearby stations to the new one (the model predicts a station's own count, not net
  new travel); unique people.

## 2. Timing: when the planned stations open

- Question: given how the official opening forecasts have moved, in which years is each branch
  likely to open?
- Data: every dated official forecast per branch in the sourced list (`statement_date`,
  `forecast_opening`). A forecast given as a year counts as the middle of that year, a quarter as
  the middle of that quarter, a month as the middle of that month.
- Measure: for consecutive forecasts of one branch, the slip rate ρ = (change in the forecast
  opening) / (time between the two statements), in years of delay per calendar year.
- Model: the opening O of a branch whose latest forecast leaves R years from now, if the
  forecast keeps moving at rate ρ, is reached when now + t = latest + ρt, so O = now + R / (1 − ρ).
  ρ is drawn by bootstrap: 10,000 resamples of all revision intervals of all branches with
  replacement, each resample's ρ the time-weighted mean of its intervals. A resample with ρ ≥ 1
  never reaches an opening and is counted as "after 2060"; so is any O after 2060.
- Published: per branch the 10th, 50th and 90th percentile of O, the share after 2060, the
  latest official forecast and the number of revisions behind it. Sensitivity, stated now: the
  same with each branch's own intervals only, where a branch has at least two.
- Check: none is possible before an opening. When a branch opens, its date is compared with the
  published range, and the comparison is recorded in the journal.
- What cannot be concluded: why a forecast moved; that a future revision follows the past rate.
  The forecasts are a small reference class from one programme and one organisation.

## Descriptive parts, not predictions

These are not fitted and need no decision rule; they are defined here so that their method is
fixed with the rest.

- Audience per station and year: the boardings from each edition, 2013–2022. Change is stated
  as a log ratio per station for 2013→2019 and 2019→2022, and as the station's share of all
  metro boardings that year.
- Dayparts: the 2019 edition's appendix gives each station's boardings 06–09, 07.30–08.30, 15–18
  and 16.30–17.30 (2020 was counted during the pandemic). The rest of the day is the day count
  minus the two three-hour bands. Within each band, and over the rest of the service day,
  boardings are spread over half-hours in proportion to the station's scheduled metro
  departures in that half-hour (today's GTFS, one ordinary Tuesday–Thursday). The index for a
  station and hour is its boardings that hour over the mean hourly boardings of all stations
  and service hours, times 100. Only the four bands are counted; the shape inside them is a
  model.
- Commuter and shopping locations: a station is a shopping location when an SCB retail area
  with at least 500 employees lies within 300 m of it. Its morning share (06–09 over the day)
  and afternoon share (15–18 over the day) are compared with the other stations'.
