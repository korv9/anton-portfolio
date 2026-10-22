# Repository rules and environments. Secret values are never managed here: they are set with
# `gh secret set` and stay out of state.

locals {
  repository = "anton-portfolio"
  # Job names in ci.yml and security.yml, run by GitHub Actions (app 15368).
  required_checks = [
    "Site (format, types, build, browser tests)",
    "Platform (tests, data contracts, dbt)",
    "Dependency audit",
    "Secret scan",
  ]
}

# Reproduces the classic branch protection on main (strict checks, conversations resolved, no
# force pushes or deletion, admins included). Classic protection cannot be imported into a
# ruleset, so this is created next to it; the owner removes the classic rule afterwards.
resource "github_repository_ruleset" "main" {
  name        = "main"
  repository  = local.repository
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["refs/heads/main"]
      exclude = []
    }
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count   = 0
      required_review_thread_resolution = true
    }

    required_status_checks {
      strict_required_status_checks_policy = true
      dynamic "required_check" {
        for_each = local.required_checks
        content {
          context        = required_check.value
          integration_id = 15368
        }
      }
    }
  }
}

# Holds the R2 credentials of the data workflows; deployable from main only.
import {
  to = github_repository_environment.data
  id = "${local.repository}:anton-portfolio"
}

resource "github_repository_environment" "data" {
  repository  = local.repository
  environment = "anton-portfolio"
  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

import {
  to = github_repository_environment_deployment_policy.data_main
  id = "${local.repository}:anton-portfolio:63199465"
}

resource "github_repository_environment_deployment_policy" "data_main" {
  repository     = local.repository
  environment    = github_repository_environment.data.environment
  branch_pattern = "main"
}

# Gate for `terraform apply` in .github/workflows/terraform.yml; main only. GitHub's create call
# is an upsert, so this also adopts the environment if a workflow run created it first.
resource "github_repository_environment" "terraform" {
  repository  = local.repository
  environment = "terraform"
  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "terraform_main" {
  repository     = local.repository
  environment    = github_repository_environment.terraform.environment
  branch_pattern = "main"
}
