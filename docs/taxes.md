# Tax data and calculation checks

The tax pipeline delivers the following data from official sources. The former
tax page and its calculator were removed from the site on 2026-10-21 (commit 35b90a67); `#taxes`
leads to `#what-does-it-even-mean`.

| Part | Source | Coverage |
|---|---|---|
| Tax revenue per tax type, Sweden and every OECD country | OECD Revenue Statistics (general government) | 1965 to the latest year, share of GDP and national currency |
| Tax on a salary by country, household and wage level | OECD Taxing Wages | 2000 to the latest year |
| Local income tax, burial and church fee per parish | Skatteverket open data | every year Skatteverket publishes |

## Decisions and you

`platform/seeds/taxes/tax_decisions.csv` names each Riksdag decision that changed a tax since
2007: the part of the rules it changed, the bill and section, the committee report, and whether
it came from the government, the committee's own proposal or a reservation. dbt ties each to
the first substantive roll call of its report (`fct_tax_decision_vote`) and to the studies its
proposal was prepared in (`fct_tax_decision_study`). Fuel decisions carry the change per litre
and the months it applied, from each bill.

The household estimate uses SCB's household budget survey (HUT 2021): spending per group, prices
including VAT, VAT = spending × rate / (100 + rate), only groups with one clear rate. It is a
floor. The 2026 food VAT cut assumes full pass-through.

## Reading the comparisons

- The **tax wedge** is income tax plus employee and employer contributions, less cash benefits, as a share of labour cost.
  - The OECD computes it at 67, 100 and 167 % of each country's own average wage.
  - Countries are therefore compared at the same place in their own wage scale, not at the same salary in kronor.
- Revenue as a share of GDP is tax *collected*, not tax *rates*.
  - It depends on what the tax pays for: pensions and health care are tax-financed in Sweden and partly private elsewhere.
  - It also depends on the size of the economy.

## Running

```bash
npm run taxes        # python platform/pipeline.py run taxes: fetch, dbt build, export
```

The dbt step selects `+tag:taxes`, so it also builds the parliament models the tax decisions
read: bills, studies, reports and roll calls. Before it fetches anything,
`platform/ingest/taxes/require_parliament.py` checks that the parliament raw files have
complete, hash-verified checkpoints, and stops with an upstream error if a session is
unfinished or a file is missing. On an empty machine, run `python platform/pipeline.py pull
parliament` or `run parliament` first. An existing gold table is not accepted in their place.
