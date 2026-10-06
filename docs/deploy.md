# Hosting: Cloudflare

The site is static files (`npm run build` → `dist/`) served by **Cloudflare Workers static
assets** at `https://antonernstsson.com`: a Worker with no script, only files. The document
shards and Parquet marts are served from the R2 bucket `anton-portfolio`, on the same Cloudflare
account (see [storage-and-serving.md](storage-and-serving.md)).

Cloudflare builds the site itself from this repository (Workers Builds): every push to `main`
is published, including the data commits the refresh workflows make, and every other branch and
pull request gets a preview URL on `workers.dev`. No workflow here deploys.

## Branches: main and a preview per pull request

`main` is production. New work never lands there directly:

1. Work happens on a feature branch, with a pull request into `main`; CI must be green.
2. Cloudflare builds the branch as a preview (`npx wrangler preview`, which needs the
   `[previews]` block in `wrangler.toml`) and comments the link on the pull request. The
   preview's address stays the same for a branch; `r2-cors.json` allows the working branch's
   so the preview can read the data.
3. The owner looks at the preview and approves the merge; merged, it is live.
4. The data refreshes commit to `main` directly (fresh data goes live without review).

## In the repository

| File | Purpose |
|---|---|
| `wrangler.toml` | Worker name, and `dist/` as its static assets |
| `.node-version` | Node 22 for Cloudflare's build image |
| `frontend/public/_headers` | Security headers; long cache for hashed assets, short for data |
| `platform/publish/r2-cors.json` | Origins allowed to read the bucket: the domain, `www`, `workers.dev`, the branch preview, local dev |
| `frontend/index.html` | Canonical URL `https://antonernstsson.com/` |

The site uses relative paths (`base: './'` and hash routing), so it works at the domain root,
on `workers.dev` and in previews without configuration.

## Setup, once

1. **Domain.** Cloudflare → Domain Registration → register `antonernstsson.com`. Its DNS is
   then on Cloudflare, which the custom domains below need.
2. **Workers.** Workers & Pages → Create → Import a repository → `korv9/anton-portfolio`, once
   for production:
   - project name `anton-portfolio` (must match `name` in `wrangler.toml`)
   - build command `npm run build`
   - deploy command `npx wrangler deploy`
   - preview command: the default, `npx wrangler preview`
   - path `/`, API token: create new

   The build publishes to `https://anton-portfolio.anton-ernstson.workers.dev`, which is
   also allowed in `r2-cors.json`. Check under Settings → Build that the production branch is
   `main`.

   Under Settings → Build, turn on builds for non-production branches, so every pull request
   gets its preview link.
3. **Domain on the site.** The Worker → Settings → Domains & Routes → Add → Custom domain:
   `antonernstsson.com`, and `www.antonernstsson.com`. To send `www` to the bare domain, add a
   redirect rule: Rules → Redirect Rules → hostname equals `www.antonernstsson.com` → dynamic
   redirect to `concat("https://antonernstsson.com", http.request.uri.path)`, status 301,
   preserve query.
4. **Domain on the data.** R2 → `anton-portfolio` → Settings → Custom Domains →
   `data.antonernstsson.com`. Then:
   - apply the CORS policy: R2 → the bucket → Settings → CORS policy → paste
     `platform/publish/r2-cors.json`;
   - set the repository variable `R2_PUBLIC_BASE` to `https://data.antonernstsson.com/`
     (Settings → Secrets and variables → Actions → Variables) and run `npm run data:catalog`
     with it exported, so `delivery.json` points at the domain; commit it;
   - once the site reads from the domain, turn off the bucket's `r2.dev` URL.
5. **Scheduled refreshes.** The schedules in `refresh-welfare.yml` (daily), `refresh-news.yml`
   (every three hours) and `refresh-jobs.yml` (monthly) are commented out until the secrets
   below are set; uncomment the `schedule:` lines to switch them on. They can be run by hand
   from the Actions tab meanwhile.
6. **Refresh secrets.** Settings → Secrets and variables → Actions → Secrets:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (an R2 API token
   with read and write on the bucket). Without them the daily refresh stops at its first step
   and the news collection does nothing.
7. **The warehouse in R2.** Actions → *Build and store the warehouse* → Run workflow. It
   fetches every public source, builds the DuckDB warehouse with dbt and stores it in the
   bucket with all its raw files (`platform/publish/warehouse_store.py`):
   `warehouse/portfolio.duckdb.gz`, `warehouse/manifest.json` (built when, from which commit,
   SHA-256, rows per schema), `warehouse/raw/` and `warehouse/features/` (the ML stages'
   outputs: embeddings, maps, clusters, the concept layer). Later runs start from the stored
   files. The ML stages run only when their output is not stored yet; choose `ml: always` to
   rerun them (seeds are fixed, so the same inputs give the same results). The first run counts
   every JobTech archive for the AI governance terms and takes a couple of hours.
   Fetch the warehouse anywhere with `python platform/publish/warehouse_store.py pull`. The
   bucket is public, so the warehouse can be downloaded by anyone; it holds only open data.
   `platform/tests/architecture/test_warehouse_workflow.py` fails if a dbt subject, a source
   or an ML stage is added without a step here.

   What lives where:

   | What | Where | Kept by |
   |---|---|---|
   | The site's JSON (every product's `frontend/public/data/**/*.json`) | Cloudflare Workers static assets | git, deployed on every push to main |
   | Parquet datasets and document shards | R2, public | *Publish to R2* (`upload.py`), verified by hash |
   | Raw source files, ML outputs, the DuckDB warehouse | R2, `warehouse/` | *Build and store the warehouse* |

## Limits

Free plan: 20,000 files and 25 MiB per file in a Worker's static assets; requests for static
assets are free and unlimited. The site is about 1,000 files; the largest is 5.7 MB. Check the
config locally with `npx wrangler deploy --dry-run` after `npm run build`.
