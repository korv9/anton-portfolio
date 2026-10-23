output "public_bucket" {
  value = cloudflare_r2_bucket.public.name
}

output "warehouse_bucket" {
  value = cloudflare_r2_bucket.warehouse.name
}

output "r2_dev_domain" {
  value = cloudflare_r2_managed_domain.public.domain
}

# Goes into the [[d1_databases]] block of wrangler.toml.
output "job_assistant_d1_id" {
  value = cloudflare_d1_database.job_assistant.id
}
