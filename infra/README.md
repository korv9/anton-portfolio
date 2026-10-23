# Infrastructure as code

Two Terraform stacks describe what [docs/deploy.md](../docs/deploy.md) used to set by hand.
Both keep their state in the private R2 bucket `anton-portfolio-tfstate`, under their own key.

| Stack | Manages | Left outside Terraform |
|---|---|---|
| `cloudflare/` | R2 bucket `anton-portfolio` (imported), the new private bucket `anton-portfolio-warehouse`, the bucket's CORS policy from `platform/publish/r2-cors.json`, the `r2.dev` address, the Worker's custom domains `antonernstsson.com` and `www` (imported), the job assistant's D1 database `job-assistant` | The Worker script and its build (Workers Builds and `wrangler.toml`); `data.antonernstsson.com` on the bucket, because the provider cannot import an R2 custom domain; the `www` redirect rule; the state bucket |
| `github/` | Ruleset for `main` with the four required checks, environment `anton-portfolio` and its `main` policy (imported), environment `terraform` | Secret values (set with `gh secret set`), the old disabled ruleset `test`, Actions variables |

`.github/workflows/terraform.yml` checks format, validates and plans both stacks on pull
requests that touch `infra/`. Applying is a manual run of that workflow from `main`.

## Bootstrap, once

The owner does these steps by hand, in this order.

1. **State bucket.** Create it once, outside Terraform:

   ```sh
   npx wrangler r2 bucket create anton-portfolio-tfstate
   ```

   Keep it private: no custom domain and no `r2.dev` address.

2. **Cloudflare API token** (My Profile → API Tokens → Create custom token), limited to this
   account and zone:
   - Account: Workers R2 Storage Edit (buckets, CORS, `r2.dev`); Workers Scripts Edit (Worker
     custom domains); D1 Edit (the job assistant's database);
   - Zone `antonernstsson.com`: Zone Read (the zone lookup).

   No resource here writes DNS records, so DNS Edit is not needed. Add it only when Terraform
   takes over DNS.

3. **R2 S3 keys for the state.** R2 → Manage API tokens → Create API token, Object Read & Write,
   restricted to the bucket `anton-portfolio-tfstate`. Note the access key ID and secret.

4. **GitHub token.** A fine-grained personal access token for `korv9/anton-portfolio` only,
   with Administration: read and write, Environments: read and write, and Metadata: read.

5. **Secrets and variables** (Settings → Secrets and variables → Actions, repository level, so
   pull request plans can read them; forks never get them):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `CLOUDFLARE_API_TOKEN` | token from step 2 |
   | Secret | `TF_STATE_ACCESS_KEY_ID` | access key ID from step 3 |
   | Secret | `TF_STATE_SECRET_ACCESS_KEY` | secret access key from step 3 |
   | Secret | `TF_GITHUB_TOKEN` | token from step 4 |
   | Variable | `CLOUDFLARE_ACCOUNT_ID` | the account ID (not secret) |
   | Variable | `TF_WORKER_DOMAIN_IDS` | JSON from step 6 |

   Set secrets with `gh secret set NAME`, which reads the value from the prompt instead of the
   command line.

6. **Worker domain IDs.** List the Worker's custom domains with a read-only call and copy their
   `id`s:

   ```sh
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains" \
     | jq '[.result[] | {(.hostname): .id}] | add'
   ```

   The result, for example `{"antonernstsson.com":"…","www.antonernstsson.com":"…"}`, is the
   value of `TF_WORKER_DOMAIN_IDS` (and of `worker_domain_ids` in a local `terraform.tfvars`).

7. **First plan.** Open a pull request that touches `infra/` (or run the workflow without
   `apply`) and read both plans in the job summary. A local run works the same way:

   ```sh
   export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…   # step 3
   export AWS_ENDPOINT_URL_S3="https://$CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com"
   cd infra/cloudflare && cp terraform.tfvars.example terraform.tfvars  # fill in
   terraform init && terraform plan
   ```

   Expected, and nothing else:
   - `cloudflare`: imports of `anton-portfolio` and both Worker domains with **no** changes;
     creates of `anton-portfolio-warehouse`, the CORS policy and the `r2.dev` setting. The
     provider cannot import the last two, so creating them writes the same policy and setting
     the bucket has (CORS also drops any origin added only in the dashboard).
   - `github`: imports of environment `anton-portfolio` and its `main` policy with no
     changes; creates of the ruleset `main`, environment `terraform` and its `main` policy.

   **Stop if a plan shows an update, a replacement or a destroy**, especially of
   `anton-portfolio`. Fix the configuration until the imports are clean.

8. **Apply.** Actions → *Terraform* → Run workflow on `main`, stack `github`, `apply` checked.
   Then the same for `cloudflare`. The first `github` run creates the `terraform`
   environment; add yourself as a required reviewer there if apply should wait for approval.

9. **After the first apply.**
   - Settings → Rules → Rulesets shows `main` as active. Then delete the classic branch
     protection rule on `main` (Settings → Branches); the ruleset replaces it.
   - Once Terraform owns CORS, stop pasting `r2-cors.json` in the dashboard. Change the
     file and apply instead.
   - The import blocks may stay; after the first apply they do nothing.

## Changing infrastructure

Edit the stack, open a pull request, read the plan in the job summary, merge, then run the
workflow with `apply` for that stack. Moving raw and warehouse files into
`anton-portfolio-warehouse` is a separate step, verified with `pipeline.py pull` before and after.
