# Data Constellation

The page is retired from the website: `#data-constellation` and `#data-catalogue` now lead to
the project index ([site-structure.md](site-structure.md)). The graph is still generated
(`npm run architecture:build`) and feeds the Trace panel of the chart feed (see below). The
page itself is gone; this document describes the graph.

`#data-constellation` showed the whole data platform as one interactive map: where the data
comes from, how it is ingested, how dbt models it, which files are published and which
products read them. The point it makes is that the portfolio is one shared platform with
several products on top, not separate dashboards; and for a reviewer, that any product can be
traced back to its sources.

The map is generated from the repository. Nothing in React lists a model or an edge.

## How the graph is built

```
npm run architecture:build     # python platform/architecture/build_graph.py
```

writes `frontend/public/data/architecture/graph.json` and registers it in the delivery
catalogue. It reads:

| Input | What it gives |
|---|---|
| `platform/target/manifest.json` (dbt; `dbt parse` is run when missing) | every model, seed and source, their paths, descriptions and materialisation, and lineage from `depends_on` |
| `frontend/public/data/schema/er.json` (`export_er.py`) | table kinds (fact, dimension, mart, bridge, seed), primary keys, columns, row counts, and relationships between tables, each measured in the data or backed by a dbt relationships test |
| `platform/architecture/registry.py` | what dbt cannot see: origins, ingesters, ML stages, publishers and their output patterns, products and shared infrastructure |
| the publisher scripts | the dbt tables each one reads, found in its source (`gold.fct_x` or a quoted name) |
| frontend code | the data paths each product's folders name; a product consumes a delivery node when one of its paths matches one of the node's files |
| files under `frontend/public/data` and `catalog.json` | which files each delivery pattern covers (including Parquet that lives only on R2) |

`validate()` refuses the graph on duplicate ids, unknown types, layers or domains, edges to a
missing node, or a data-flow edge that runs right to left. The build fails if a registry entry
names a file that does not exist.

A new dbt model appears on the next build without any frontend change. A new source, ingester,
publisher or product needs one registry entry.

## Domains

| Domain | Assigned from |
|---|---|
| Politics | dbt folders `parliament`, `politics`, `news`, `taxes`; the politics product |
| Job market | dbt folders `jobs`, `market`; seeds at the root of `seeds/` (role and technology patterns) |
| Shared platform | `models/gold/shared` (date, period, region, indicator … dimensions), SCB, and the infrastructure |
| Sweden | dbt folder `welfare` |
| Symbolic Atlas | dbt folder `symbolic` |
| EU AI Act | dbt folders `eu_ai_act`, `ai_politics`, `job_ai_governance` and `cross_domain`; the Publications Office and the Commission as sources |
| Philosophy Atlas | dbt folder `philosophy` |
| Concept layer | dbt folder `concepts` |

Smaller standalone projects (DrugComb, DiVA, Homie) are not in the map: they do not
run on the dbt warehouse.

## Node types

| Type | Id | Meaning | Marker on the retired page |
|---|---|---|---|
| source | `src:<id>` | an external system (Riksdagen, SCB, Gutenberg …) | large star with a ring |
| ingestion | `ingest:<id>` | a `platform/ingest/<dir>` loader | small square |
| raw | `raw:<dbt source>` | a dbt source: raw landing tables | small diamond |
| seed | `dbt:<name>` | reference data in `seeds/` | hollow circle |
| bronze, silver, gold | `dbt:<name>` | dbt models by layer | dots, gold larger and brighter |
| ml | `ml:<id>` | analytical stages outside dbt (embeddings, clustering, experiments) | four-pointed star |
| delivery | `out:<pattern>` | a set of published files under `frontend/public/data` | hollow square |
| frontend | `app:<id>` | a product | large planet |
| shared | `infra:<id>` | rawstore, the EU legal parser, dbt + DuckDB, the delivery catalogue, Cloudflare R2 | double ring |

Models dbt switches off by default (the job-ad clustering marts, enabled by a dbt variable) are
included and marked `enabled: false`.

## Edge types

| Type | Meaning | Drawn as on the retired page |
|---|---|---|
| `lineage` | data built from data: origin → ingester → raw → models → ML | solid line |
| `delivery` | a published file written from a table (or ML output) by a publisher (`via`) | accent line |
| `frontend-consumption` | a product reads a published file | accent line |
| `relationship` | a key joins two tables (cardinality, basis) | dashed |
| `infrastructure` | a stage runs on shared infrastructure (an ingester that stores through rawstore, a dbt Python model or ingester that imports `platform/legal`) | dotted |

Physical lineage, logical relationships and product consumption are separate edge types and
are never drawn the same way: a join is not a build step.

## Graph JSON

```json
{
  "nodes": [{ "id": "dbt:mart_symbol_atlas", "label": "mart_symbol_atlas", "type": "gold",
              "layer": "gold", "domain": "symbolic",
              "path": "platform/models/gold/symbolic/mart_symbol_atlas.sql",
              "description": "…", "materialized": "table", "kind": "mart",
              "keys": ["occurrence_id"], "rows": 4804, "columns": ["…"], "enabled": true }],
  "edges": [{ "source": "dbt:int_symbol_occurrences", "target": "dbt:mart_symbol_atlas",
              "type": "lineage" }],
  "domains": [{ "id": "symbolic", "label": "Symbolic Atlas", "lane": 4,
                "counts": { "sources": 1, "models": 5, "gold": 2, "delivery": 9 } }],
  "layers": ["source", "ingestion", "raw", "bronze", "silver", "ml", "gold", "delivery", "frontend"],
  "generated_at": "…", "dbt_version": "…"
}
```

Delivery nodes add `files`, `formats`, `examples` and `published_by` (script paths, `legacy`
for the pre-warehouse politics builder); sources add `url`; products add `href`; raw nodes add
their `tables`.

## Trace

The page, *Trace this result* (`frontend/src/ui/Trace.tsx`) and the data catalogue
(`frontend/src/catalogue/`) were removed (commits 96b9418d and 35b90a67). Trace is now
`frontend/src/meaning/Trace.tsx`, the panel of an opened feed card. It reads
`architecture/feed-provenance.json`, which `platform/architecture/feed_provenance.py` writes from
this graph, the feed posts' declared sources, the dbt schema files and the quality checks.

## Adding things

- A source: add an `ORIGINS` entry and list it in its ingester's `origins`.
- An ingester: add an `INGESTION` entry with the dbt sources (`raw`) it fills.
- A publisher: add a `PUBLISHERS` entry with its output patterns; inputs are detected, or
  set `inputs` per output when the script reads delivery files or ML output instead.
- A product: add a `PRODUCTS` entry with its route and the frontend folders that hold its
  data loading.

Then run `npm run architecture:build`; the Python tests
(`platform/tests/architecture/test_graph.py`, `test_feed_provenance.py`) check the result.

## Limitations

- Publisher inputs are found by name in the script source; a table read through a variable
  name would be missed, and `inputs` must then be set by hand.
- Product consumption is matched from string literals in frontend code; a path assembled at run
  time in several parts may not be found (the welfare Parquet partitions are matched by prefix).
- Some politics files are still built by `platform/legacy/build_gold.py` from raw Riksdagen data
  without the warehouse; they are marked legacy, with an edge from the ingester.
- Row counts come from the ER export and exist only for tables built in the local warehouse.
- The graph shows the architecture, not run state.
