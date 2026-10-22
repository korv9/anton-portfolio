variable "account_id" {
  description = "Cloudflare account ID that owns the buckets and the Worker. Not a secret."
  type        = string
}

variable "worker_domain_ids" {
  description = "IDs of the Worker's existing custom domains, keyed by hostname; used only to import them."
  type        = map(string)
}
