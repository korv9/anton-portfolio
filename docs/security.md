# Security checks

The site serves static files. Production credentials belong in the GitHub
`anton-portfolio` environment and Cloudflare secrets. PR CI has no R2 credentials.
Data publication jobs accept only `main` and use the separate environment.

## Local checks

```sh
npm audit --audit-level=moderate
npm run test:security
python -m pytest platform/tests/architecture/test_security.py -q
gitleaks git --redact --no-banner .
```

`test:security` builds the site and applies the built `_headers` policy to browser
responses. It checks startup, navigation, the CV dialog and blocking of injected
inline and external scripts. It does not prove that Cloudflare serves those headers.
Styles allow inline declarations because the charts and React components use them.
Scripts allow only the site's origin. Framing allows the same origin for the CV PDF;
external sites cannot embed the page.

The Security workflow runs on pushes, pull requests and weekly. It audits npm and
each Python lock, checks the upstream version of the CPU PyTorch wheel, and scans
Git history with a checksum-verified Gitleaks binary. `.gitleaksignore` contains
reviewed historical false positives for public identifiers, indicator keys and job
titles. Each exception names an exact commit, file, rule and line. Review new
findings individually. A real credential must be revoked, not added to the baseline.

## Updating Python locks

The locks target Python 3.12 on Linux, matching GitHub Actions. Keep the small input
files as the dependency declarations. The ML and news inputs include the base
requirements so their locks resolve the complete environment. The ML input pins
one CPU PyTorch wheel by URL and SHA-256; check its version and hash against the
official PyTorch CPU index before changing it.

Regenerate after changing an input or when addressing an advisory:

```sh
uv pip compile platform/requirements.txt --upgrade --python-version 3.12 --python-platform linux --generate-hashes --no-emit-index-url -o platform/requirements-ci.lock
uv pip compile platform/requirements-ml.in --upgrade --python-version 3.12 --python-platform linux --generate-hashes --no-emit-index-url -o platform/requirements-ml.lock
uv pip compile platform/requirements-news.in --upgrade --python-version 3.12 --python-platform linux --generate-hashes --no-emit-index-url -o platform/requirements-news.lock
uv pip compile platform/requirements-security.in --upgrade --python-version 3.12 --python-platform linux --generate-hashes --no-emit-index-url -o platform/requirements-security.lock
```

Install the security tools with
`pip install --require-hashes -r platform/requirements-security.lock`, then run
`pip-audit --require-hashes --disable-pip -r <lock>` for each lock. The workflow
audits the upstream PyTorch version separately because pip-audit skips wheel URLs.
Run the tests before accepting dependency updates. Dependabot checks npm, Python
declarations and Actions weekly; regenerate the locks for Python updates.

## Hosting settings and verification after publication

GitHub settings verified and updated on 15 October 2026:

- The `anton-portfolio` environment accepts only the `main` branch. Required
  reviewers are not enabled on this environment because scheduled data refreshes
  also use it.
- `main` requires both CI jobs, Dependency audit and Secret scan from GitHub
  Actions, an up-to-date branch and resolved review conversations. The protections
  also apply to administrators; force pushes and branch deletion are disabled.
  The Security workflow in this change must run successfully before merging it.
- No R2 access or secret key was present in repository secrets. R2 credentials
  were present in the separate environment. Their bucket permissions still need
  to be checked in Cloudflare.

Cloudflare Always Use HTTPS still needs verification or activation with a valid
Cloudflare login. `_headers` sets HSTS for one year; it does not force an HTTP
request to redirect.

After the changes have been published, verify both entry points:

```sh
python scripts/check_security_headers.py https://antonernstsson.com/
python scripts/check_security_headers.py https://anton-portfolio.anton-ernstson.workers.dev/
```

The verifier checks the HTTP redirect, HTTPS certificate validation and enforced
security headers. A blocked or failed request is a failure, not a verified result.
