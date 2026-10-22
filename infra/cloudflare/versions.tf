# State lives in the private R2 bucket anton-portfolio-tfstate, created by hand (infra/README.md).
# The endpoint comes from AWS_ENDPOINT_URL_S3 and the R2 S3 keys from AWS_ACCESS_KEY_ID and
# AWS_SECRET_ACCESS_KEY, so no account-specific value is committed here.
terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket                      = "anton-portfolio-tfstate"
    key                         = "cloudflare/terraform.tfstate"
    region                      = "auto"
    use_lockfile                = true
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }
}

# Reads CLOUDFLARE_API_TOKEN from the environment.
provider "cloudflare" {}
