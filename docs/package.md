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
   Nothing existing moves; `platform/lib/common.py` stays until step 5.
2. **Storage and releases (done).** `rawstore`, `delivery`, `upload` and `warehouse_store` are in
   `portfolio.storage`; `release`, `retention` and `dq_gate` in `portfolio.publish`, because a
   release runs the quality gate, which `storage` may not import. Each old path is a shim
   that puts the moved module in `sys.modules` under the old name, so `import rawstore`,
   `from lib.rawstore import …` and test monkeypatches all reach the one module, and
   `python platform/publish/release.py …` still runs. Every workflow installs the package
   (`.github/actions/data-setup`); `setuptools` is pinned in `requirements.txt` for that.
3. **Exports**, one domain at a time, onto `core.io` and `core.db`. Done so far: the catalogue
   (`build_catalog` → `portfolio.publish.catalog`, with `register`, which 18 exporters reached
   through a path edit) and ai_politics, concepts, eu_ai_act, job_ai_governance, philosophy and
   quality. Proof: each set of exports run before and after against the same warehouse, every
   file it writes (41, catalogue included) hashed; all identical. The first run also found the
   philosophy export was not byte-stable between runs (an unordered `select distinct`), fixed
   first so the comparison meant something.
4. **Ingest and ML**, including the parts of `ml/` the pipeline imports; dbt's Python models
   import the package instead of adding the working directory to `sys.path`.
5. **Clean-up.** The shims and every `sys.path.insert` go; `pipeline.yml` calls
   `python -m portfolio`; ruff and mypy run on `core` and `storage`.
