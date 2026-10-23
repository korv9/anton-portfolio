# Cloudflare resources around the site and its data (docs/deploy.md). The Worker script itself is
# deployed by Workers Builds and wrangler.toml; only its custom domains are managed here.

locals {
  public_bucket = "anton-portfolio"
  zone          = "antonernstsson.com"
  worker        = "anton-portfolio" # `name` in wrangler.toml
  # platform/publish/r2-cors.json stays the single source of truth for the bucket's CORS policy.
  cors = jsondecode(file("${path.module}/../../platform/publish/r2-cors.json"))
}

data "cloudflare_zone" "site" {
  filter = { name = local.zone }
}

# Public delivery bucket: marts, document shards, releases and manifests.
import {
  to = cloudflare_r2_bucket.public
  id = "${var.account_id}/${local.public_bucket}/default"
}

resource "cloudflare_r2_bucket" "public" {
  account_id = var.account_id
  name       = local.public_bucket

  lifecycle {
    prevent_destroy = true
  }
}

# Private bucket for raw files and the warehouse; created empty. Moving data into it is a
# later phase (pipeline.py pull verification before and after).
resource "cloudflare_r2_bucket" "warehouse" {
  account_id = var.account_id
  name       = "anton-portfolio-warehouse"

  lifecycle {
    prevent_destroy = true
  }
}

# The provider cannot import CORS (v5.28). Creating it overwrites the bucket's policy with
# r2-cors.json, which is the intended state; after that, never edit CORS in the dashboard.
resource "cloudflare_r2_bucket_cors" "public" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.public.name
  rules = [for rule in local.cors : {
    allowed = {
      methods = rule.AllowedMethods
      origins = rule.AllowedOrigins
      headers = rule.AllowedHeaders
    }
    expose_headers  = rule.ExposeHeaders
    max_age_seconds = rule.MaxAgeSeconds
  }]
}

# The r2.dev address stays on: delivery.json and build_catalog.py fall back to it. Not
# importable either; creating it sets the same enabled state.
resource "cloudflare_r2_managed_domain" "public" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.public.name
  enabled     = true
}

# data.antonernstsson.com on the bucket stays a dashboard setting: cloudflare_r2_custom_domain
# has no import in v5.28, and creating it over the live domain is not known to be safe.

# Bucket lifecycle stays R2's default (abort incomplete multipart uploads after seven days).
# No expiry rules: releases are removed only by platform/publish/retention.py.

import {
  for_each = var.worker_domain_ids
  to       = cloudflare_workers_custom_domain.site[each.key]
  id       = "${var.account_id}/${each.value}"
}

resource "cloudflare_workers_custom_domain" "site" {
  for_each   = var.worker_domain_ids
  account_id = var.account_id
  hostname   = each.key
  service    = local.worker
  zone_id    = data.cloudflare_zone.site.id
}

# The job assistant's owner records (worker/jobs.ts, docs/job-assistant.md): profile drafts and
# versions, uploaded CVs, review statuses and relevance labels. The table comes from the
# migration in worker/migrations/, applied with wrangler after this database exists.
resource "cloudflare_d1_database" "job_assistant" {
  account_id = var.account_id
  name       = "job-assistant"

  lifecycle {
    prevent_destroy = true
  }
}
