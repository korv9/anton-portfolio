# Cluster Visuals: clustering experiments

The experiments view shows the runs that `ml/experiments` registers for four domains
(philosophy, symbolic, jobs, debates). The frontend code is in
`frontend/src/clusters/experiments/`.

## Addresses

- `#cluster-visuals` ends with a section that shows each domain's champion run.
  `?domain=jobs` picks the domain and `?group=3` picks a group of that champion.
- `#cluster-visuals-experiments` lists candidates and rejected runs with their status.
  `?domain=jobs` picks the domain. With no `run`, the first non-champion run opens.
- `#cluster-visuals-experiments?run=<run_id>&group=<n>` opens any registered run, champion
  included, and one of its groups. Picking a group in the table or under the map rewrites
  `group` in place, so the address can always be shared.

## Data

`frontend/public/data/cluster-experiments/index.json` loads with the page. A run's file,
`runs/<run_id>.json`, loads only when that run is opened. Both are written by
`ml/experiments/export.py`. The view reads them as they are:

- The coordinates note from the index appears above the maps. Each run's map is drawn
  again from its own points, and nothing moves from one run's map to another's.
- Group names say what the export says about them. A `generated...` status reads
  "Generated, not reviewed". Only `reviewed` or `human...` reads as reviewed.
- The table against the champion lists `acceptance.criteria` row by row: the rule from
  the frozen criteria file, the candidate value, the champion value and whether it passed.
  An `any_of` criterion is shown with its alternatives indented under it.

States: loading, "No runs registered yet." (a 404, a release without the file, or an
index with no runs), an error when the index or a run file fails, and "No champion yet"
for a domain without one.

## Delivery

The folder belongs to the `baseline` delivery group (`configs/delivery/baseline.json`
includes everything not excluded). The baseline spec validates `index.json` against
`configs/delivery/schemas/clusters/experiments-index.json`. Its check
`platform/publish/validate_cluster_experiments.py` validates every run file against
`experiments-run.json` and compares the index with the run files: the same statuses and
domains, and at most one champion per domain. With no folder the check passes. The
catalogue (`npm run data:catalog`) picks the files up by scanning `public/data`.

## Tests

`frontend/tests/cluster-experiments.spec.ts` uses synthetic route-mocked fixtures only.
It covers the champion default, the experiments list, a run and group deep link, the
empty and error states, phone width and axe. `CX_SCREENS=1` also saves screenshots to
`tmp/screens-experiments/`.
