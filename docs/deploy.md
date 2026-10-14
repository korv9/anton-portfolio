# Hosting: Cloudflare

The site is static files (`npm run build` → `dist/`) served by Cloudflare Workers static
assets at `https://antonernstsson.com`, plus a small Worker script (`worker/index.ts`) for the
two Workers AI demos ([workers-ai.md](workers-ai.md)). Requests to `/api/*` run the script
first; every other request is served from the files as before, and a request that matches no
file is handed back to the files by the script. The site's JSON
is part of those files. Parquet marts and document shards are served from the R2 bucket
`anton-portfolio` on the same Cloudflare account, which also holds the versioned data releases
the site does not read ([storage-and-serving.md](storage-and-serving.md)).

Cloudflare builds the site from this repository (Workers Builds). Every push to `main` is
published, and every other branch and pull request gets a preview URL on `workers.dev`. No
workflow here deploys the site.

## Branches: main and a preview per pull request

`main` is production. New work never lands there directly:

1. Work happens on a feature branch, with a pull request into `main`; CI must be green.
2. Cloudflare builds the branch as a preview (`npx wrangler preview`, which needs the
   `[previews]` block in `wrangler.toml`) and comments the link on the pull request. The
   preview's address stays the same for a branch; `r2-cors.json` allows the working branch's
   so the preview can read the data.
3. The owner looks at the preview and approves the merge; merged, it is live.
4. The data workflows commit nothing. They publish versioned releases to R2
   ([pipeline.md](pipeline.md)).

## In the repository

| File | Purpose |
|---|---|
| `wrangler.toml` | Worker name, `dist/` as its static assets, the script for `/api/*`, the Workers AI and rate-limit bindings |
| `worker/index.ts` | `/api/embed` and `/api/answer`; tests in `worker/index.test.ts`, run by `npm run test:unit` |
| `.node-version` | Node 22 for Cloudflare's build image |
| `frontend/public/_headers` | Security headers; long cache for hashed assets, short for data. It does not apply to responses the Worker script makes: `/api/*` sets its own `Cache-Control: no-store`, `X-Content-Type-Options` and `Referrer-Policy` |
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
     (Settings → Secrets and variables → Actions → Variables). To move the committed
     `delivery.json` to the domain, run `npm run data:catalog` with the variable exported and
     commit the result;
   - once the site reads from the domain, turn off the bucket's `r2.dev` URL.
5. **Scheduled refreshes.** Each morning (UTC): `refresh-jobs.yml` at 04:23, `refresh-welfare.yml`
   at 04:37 (welfare, taxes and parliament) and `refresh-news.yml` at 05:17. Every Saturday at
   21:13 `build-warehouse.yml` rebuilds every subject, including Riksdag speeches and the
   analyses built on them. Each publishes a versioned release to R2; none commits data. The
   site does not read these releases: it serves the data committed under
   `frontend/public/data` ([storage-and-serving.md](storage-and-serving.md)). They run in the `anton-portfolio` environment, whose secrets hold the R2
   credentials, and can also be run by hand from the Actions tab. To pause one, comment out its
   `schedule:` lines. [pipeline.md](pipeline.md) lists every subject and its schedule.
6. **Refresh secrets.** Settings → Environments → `anton-portfolio` → Secrets:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (an R2 API token
   with read and write on the bucket). Without them the daily refresh stops at its first step
   and the news collection does nothing.
7. **The first release.** Actions → `publish-r2.yml` → Run workflow. It stages every delivery
   group and activates them together; give it `manifests/pipeline-smoke.json` as
   `manifest_key` to check the whole bundle apart from the production pointer, then
   `manifests/current.json`. The site is not wired to the manifest
   ([r2-delivery-contract.md](r2-delivery-contract.md)).
8. **The warehouse in R2.** Actions → *Build, store and publish the warehouse* → Run workflow. It
   fetches every public source, builds the DuckDB warehouse with dbt and stores it in the
   bucket with all its raw files (`platform/publish/warehouse_store.py`):
   `warehouse/portfolio.duckdb.gz`, `warehouse/manifest.json` (built when, from which commit,
   SHA-256, rows per schema), `warehouse/raw/` and `warehouse/features/` (the ML stages'
   outputs: embeddings, maps, clusters, the concept layer). Later runs start from the stored
   files. Run by hand, the ML stages run only when their output is not stored yet; choose
   `ml: always` to rerun them (seeds are fixed, so the same inputs give the same results). The first run counts
   every JobTech archive for the AI governance terms and takes a couple of hours.
   Fetch the warehouse anywhere with `python platform/publish/warehouse_store.py pull`. The
   bucket is public, so the warehouse can be downloaded by anyone; it holds only open data.
   `platform/tests/architecture/test_pipeline_workflows.py` fails if a dbt subject, a source
   or an ML stage is left out of the weekly run.

## Limits

Free plan: 20,000 files and 25 MiB per file in a Worker's static assets; requests for static
assets are free and unlimited. Requests that run the script (`/api/*`, and addresses that match
no file) count against the Free plan's 100,000 requests a day and 10 ms CPU each; Workers AI
has 10,000 neurons a day. The `[[ratelimits]]` binding (20 requests a minute per IP and
location) passes `npx wrangler deploy --dry-run`; whether the Free plan accepts it shows on the
first preview deploy. If it is rejected, remove the block: the neuron allocation is the hard
limit either way.

`npx wrangler dev` needs a remote session for the AI binding. Wrangler reads
`CLOUDFLARE_API_TOKEN` from `.env`, and that token needs the Workers Scripts permission for a
remote session; without it, run `npx wrangler login` and start dev without the token in the
environment. A local build on 13 October 2026 had 950 files, the largest
5.4 MB. Check the config locally with `npx wrangler deploy --dry-run` after `npm run build`.
