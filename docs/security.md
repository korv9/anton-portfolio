# Security checks

The site is static files behind a Cloudflare Worker, which also answers the Workers AI and job
assistant APIs (`worker/`). Production credentials belong in the GitHub
`anton-portfolio` environment and Cloudflare secrets. PR CI has no R2 credentials.
Data publication jobs accept only `main` and use the separate environment.

## The Worker

The Worker fails closed. Both `/api/embed` and `/api/answer` take POST only, answer 403 to a request
with another site's `Origin`, and answer 503 when the `RATE_LIMITER` binding is missing, because
Workers AI spends the account's neurons. `/api/jobs/*` also answers 503 without the limiter. Job
writes, CV reads and the draft profile need the `JOB_ASSIST_TOKEN` bearer token, and writes refuse a
foreign origin (`worker/jobs.ts`). `worker/index.test.ts` tests the AI routes.

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
Git history with a checksum-verified Gitleaks binary. A failed run on `main` opens or
comments on an issue, and a successful one closes it. `.gitleaks.toml` extends the default rules
and allowlists the generated files under `frontend/public/data/` and one reviewed commit, so a real
credential committed into that folder would not be reported. `.gitleaksignore` contains reviewed
historical false positives for public identifiers, indicator keys and job titles. Each exception
names an exact commit, file, rule and line. Review new findings individually. A real credential
must be revoked, not added to the baseline.

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
Run the tests before accepting dependency updates. Dependabot checks npm and Actions
weekly, including the `data-setup` action. It leaves Python out because it cannot regenerate hash
locks, so pip-audit in the Security workflow reports vulnerable pins and the locks are regenerated
by hand.

## Hosting settings and verification after publication

GitHub settings verified and updated on 15 October 2026:

- The `anton-portfolio` environment accepts only the `main` branch. Required
  reviewers are not enabled on this environment because scheduled data refreshes
  also use it.
- `main` requires both CI jobs, Dependency audit and Secret scan from GitHub
  Actions, an up-to-date branch and resolved review conversations. The protections
  also apply to administrators; force pushes and branch deletion are disabled.
  The `ML tests` job added to `ci.yml` on 2026-11-01 is not a required check.
- No R2 access or secret key was present in repository secrets. R2 credentials
  were present in the separate environment. Their bucket permissions have not
  been checked in Cloudflare.

Whether Cloudflare's Always Use HTTPS is on has not been verified. `_headers` sets HSTS for one year; it does not force an HTTP
request to redirect.

Cloudflare JavaScript Detections inject an inline script
(`/cdn-cgi/challenge-platform/scripts/jsd/main`) into every page. Its hash changes per request,
so the CSP cannot allow it; the browser blocks it and logs a console error. Turning the feature
off (Cloudflare dashboard, Security, Bots) removes the error.

After the changes have been published, verify both entry points:

```sh
python scripts/check_security_headers.py https://antonernstsson.com/
python scripts/check_security_headers.py https://anton-portfolio.anton-ernstson.workers.dev/
```

The verifier checks the HTTP redirect, HTTPS certificate validation and enforced
security headers. A blocked or failed request is a failure, not a verified result.
