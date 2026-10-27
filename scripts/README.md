# scripts

Repository tools run by npm scripts and CI. None of them installs, deletes or deploys.

| Script | Run with | What it does |
|---|---|---|
| `verify.mjs` | `npm run verify:quick\|full\|delivery` | The verification levels in [development.md](../docs/development.md); logs under `tmp/checks/` |
| `preflight.py` | called by `verify.mjs` | Checks free disk space and installed dependencies |
| `workspaces.py` | `npm run workspaces` | Reports worktrees that look merged and clean; removes nothing |
| `check_compliance_release.mjs` | `npm run compliance:check` (part of `build`) | Checks the committed compliance release and its hash |
| `check_job_companies.mjs` | `npm run jobs:check` (part of `build`) | Parses the committed job and company data with the frontend's own parsers |
| `check_security_headers.py` | `python scripts/check_security_headers.py URL` | Checks a deployed site's HTTPS headers and HTTP redirect |
| `rank_local_jobs.mjs` | by hand, locally | Ranks jobs against a private local profile; its output never enters a public release |
| `start_cluster_lab.ps1` | by hand, PowerShell | Starts a Cluster Lab run with `configs/cluster_lab/overnight.yaml` |
