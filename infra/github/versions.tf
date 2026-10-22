# Same state bucket as infra/cloudflare, another key. Backend credentials as described there.
terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket                      = "anton-portfolio-tfstate"
    key                         = "github/terraform.tfstate"
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
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }
}

# Reads GITHUB_TOKEN from the environment: a fine-grained token for this repository only.
provider "github" {
  owner = "korv9"
}
