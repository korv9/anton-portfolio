output "public_bucket" {
  value = cloudflare_r2_bucket.public.name
}

output "warehouse_bucket" {
  value = cloudflare_r2_bucket.warehouse.name
}

output "r2_dev_domain" {
  value = cloudflare_r2_managed_domain.public.domain
}
