# Hosting: Cloudflare Pages

The site is static files (`npm run build` → `dist/`) served by **Cloudflare Pages** at
`https://antonernstsson.com`. The document shards and Parquet marts are served from the R2
bucket `anton-portfolio`, on the same Cloudflare account (see
[storage-and-serving.md](storage-and-serving.md)).

Cloudflare builds the site itself from this repository: every push to `main` is published,
including the data commits the refresh workflows make, and every other branch and pull request
gets a preview URL (`<hash>.anton-portfolio.pages.dev`). No workflow here deploys.

## In the repository

| File | Purpose |
|---|---|
| `wrangler.toml` | Pages project name and build output directory (`dist`) |
| `.node-version` | Node 22 for Cloudflare's build image |
| `frontend/public/_headers` | Security headers; long cache for hashed assets, short for data |
| `platform/publish/r2-cors.json` | Origins allowed to read the bucket: the domain, `www`, `pages.dev`, local dev |
| `frontend/index.html` | Canonical URL `https://antonernstsson.com/` |

The site uses relative paths (`base: './'` and hash routing), so it works at the domain root,
on `pages.dev` and in previews without configuration.

## Setup, once

1. **Domain.** Cloudflare → Domain Registration → register `antonernstsson.com`. Its DNS is
   then on Cloudflare, which the R2 custom domain needs.
2. **Pages project.** Workers & Pages → Create → Pages → Connect to Git →
   `korv9/anton-portfolio`:
   - production branch `main`
   - build command `npm run build`
   - build output directory `dist`

   The first build publishes to `anton-portfolio.pages.dev` (Cloudflare adds a suffix if the
   name is taken; then add that address to `r2-cors.json`).
3. **Domain on the site.** The Pages project → Custom domains → add `antonernstsson.com`, and
   `www.antonernstsson.com`. To send `www` to the bare domain, add a redirect rule: Rules →
   Redirect Rules → hostname equals `www.antonernstsson.com` → dynamic redirect to
   `concat("https://antonernstsson.com", http.request.uri.path)`, status 301, preserve query.
4. **Domain on the data.** R2 → `anton-portfolio` → Settings → Custom Domains →
   `data.antonernstsson.com`. Then:
   - apply the CORS policy: R2 → the bucket → Settings → CORS policy → paste
     `platform/publish/r2-cors.json`;
   - set the repository variable `R2_PUBLIC_BASE` to `https://data.antonernstsson.com/`
     (Settings → Secrets and variables → Actions → Variables) and run `npm run data:catalog`
     with it exported, so `delivery.json` points at the domain; commit it;
   - once the site reads from the domain, turn off the bucket's `r2.dev` URL.
5. **Refresh secrets.** Settings → Secrets and variables → Actions → Secrets:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (an R2 API token
   with read and write on the bucket). Without them the daily refresh stops at its first step.

## Limits

Free plan: 500 builds a month, 20,000 files and 25 MiB per file per deployment. The site is
766 files; the largest is 5.7 MB.
