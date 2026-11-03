# The platform as a package

The pipeline grew as 149 runnable scripts that found each other by editing `sys.path` (about
260 times) and worked out their own paths (`ROOT` about 110 times, `PORTFOLIO_DB` 35). This
moves them into one installable package, `portfolio` under `src/`, a step at a time.

```bash
pip install --require-hashes -r platform/requirements-ci.lock
pip install --require-hashes -r platform/requirements-dev.lock
pip install --no-deps --no-build-isolation -e .
lint-imports
```

## Layers

Higher layers may import lower ones, never the reverse; `lint-imports` enforces it in CI
(`[tool.importlinter]` in `pyproject.toml`). Layers on one line are independent of each other.

| Layer | Holds |
|---|---|
| `portfolio.pipeline` | the registry runner and the `portfolio` command |
| `portfolio.publish` · `portfolio.quality` | exports per domain; the gate, measures and validity |
| `portfolio.ml` · `portfolio.ingest` | embeddings and clustering; one subpackage per source |
| `portfolio.storage` | raw store, delivery, releases, retention, warehouse backup |
| `portfolio.core` | `config` (paths, environment), `io` (JSON, hashing), `db` (the warehouse) |

The dbt project stays in `platform/models`, beside the package rather than inside it.

## Steps

Each step is one pull request. A step that moves an export is proven by the published files:
their sha256 before and after must be identical.

1. **Core.** `pyproject.toml`, `portfolio.core`, the layer contract, `requirements-dev.lock`.
   Nothing existing moves; `platform/lib/common.py` stayed until step 5.
2. **Storage and releases (done).** `rawstore`, `delivery`, `upload` and `warehouse_store` are in
   `portfolio.storage`; `release`, `retention` and `dq_gate` in `portfolio.publish`, because a
   release runs the quality gate, which `storage` may not import. Each old path was a shim
   that put the moved module in `sys.modules` under the old name until step 5. Every workflow
   that runs these modules installs the package
   (`.github/actions/data-setup`); `setuptools` is pinned in `requirements.txt` for that.
3. **Exports**, one domain at a time, onto `core.io` and `core.db`. Done so far: the catalogue
   (`build_catalog` → `portfolio.publish.catalog`, with `register`, which 18 exporters reached
   through a path edit) and ai_politics, concepts, eu_ai_act, job_ai_governance, philosophy and
   quality. Proof: each set of exports run before and after against the same warehouse, every
   file it writes (41, catalogue included) hashed; all identical. The first run also found the
   philosophy export was not byte-stable between runs (an unordered `select distinct`), fixed
   first so the comparison meant something. Then the six SWEDEN exporters (measurement, language,
   similarity, belonging, futures, connections), after the same kind of fix in measurement
   (two unordered domain counts). From here `core.io.write_json` always writes LF: on Windows
   most exporters wrote CRLF, so a local run differed from CI's bytes; on Linux nothing changes.
   The SWEDEN proof is therefore LF-normalised (23 files identical; the catalogue compared
   without the sizes and hashes that embed the line endings); the two exporters that already
   wrote LF are identical byte for byte. Then the cluster exports (`clusters/export.py`,
   `three_swedens.py`, through `clusters/stats.py`) and the AI governance timeline; the cluster
   files byte-identical, the timeline identical with CRLF normalised. The cluster *fitting*
   scripts in `clusters/` are ML stages and wait for step 4. `export_ai_act_diffusion.py` is left
   as it is: its mart is built by a hand-run stage outside the pipeline, so no warehouse holds it
   and a change could not be proven. Then market, news, er and schema: the first runs found three
   more unstable outputs (party counts and fetch status without an order, two ER relations tied
   on their sort key, schema samples from a parallel `limit`), fixed first. Proof: 361 files,
   identical with CRLF normalised and each run's own `generated_at` blanked; the 356 schema
   samples identical byte for byte. Still to move: welfare, taxes, sfs, parliament, politics and
   debates, which read dbt run results only a dbt run on the pulled warehouse produces.
4. **Ingest and ML**, including the parts of `ml/` the pipeline imports; dbt's Python models
   import the package instead of adding the working directory to `sys.path`.
5. **Clean-up (shims done).** The shims (`rawstore`, `release`, `retention`, `dq_gate`,
   `upload`, `warehouse_store`, `build_catalog`) are gone, and so are the old contents of `platform/lib/common.py`.
   Two aliases stay in `platform/lib` for `platform/legacy/build_gold.py` alone: `common.py`
   (now `core.io` under that name) and `delivery.py`. `gold/semantic-model.json` pins the
   builder's sha256, so the file cannot change without a gold rebuild; both go with that rebuild.
   Callers import `portfolio.storage.*`, `portfolio.publish.*` and `portfolio.core.*`;
   `pipeline.yml`, the workflows and `package.json` run `python -m portfolio.publish.release`,
   `python -m portfolio.storage.warehouse_store` and so on, with the same arguments. The welfare,
   parliament, taxes and sfs exports write through `core.io.write_json`, with `newline=False`
   where `common.write_json` wrote no final newline: their 22 committed files come out byte for
   byte the same. Still open: the other `sys.path.insert` lines (sibling scripts, and `pxweb`,
   `parties` and `gold_contract` in `platform/lib`), `pipeline.yml` calling `python -m portfolio`,
   and ruff and mypy on `core` and `storage`.
