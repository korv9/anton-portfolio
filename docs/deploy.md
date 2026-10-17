# Hosting: Cloudflare

The site is static files (`npm run build` → `dist/`) served by Cloudflare Workers static
assets at `https://antonernstsson.com`, plus a small Worker script (`worker/index.ts`) for the
two Workers AI demos ([workers-ai.md](workers-ai.md)). Requests to `/api/*` run the script
first; every other request is served from the files as before, and a request that matches no
file is handed back to the files by the script. The site's JSON
is part of those files. Parquet marts and document shards are served from the R2 bucket
`anton-portfolio` on the same Cloudflare account, which also holds the versioned data releases
the site does not read ([storage-and-serving.md](storage-and-serving.md)).

   `platform/tests/architecture/test_warehouse_workflow.py` fails if a dbt subject, a source
   or an ML stage is added without a step here.

   What lives where:

   | What | Where | Kept by |
   |---|---|---|
   | Approved JSON, Parquet and document shards | R2, `releases/<group>/<id>/files/` | `release.py`, with exact-byte readback and activation last |
   | Static assets, code and committed reproduction snapshots | Git and Cloudflare Workers | code deployments; snapshots retained during migration |
   | Raw source files, ML outputs, the DuckDB warehouse | R2, `warehouse/` | *Build and store the warehouse* |
