# Development workflow

Start from the current accepted branch. Query the graph for the affected code, then
read the relevant source. Define the behavior to preserve or change and its check.

## Verification levels

| Level | Command | Scope |
| --- | --- | --- |
| Quick | `npm run verify:quick` | TypeScript, formatting, frontend and Worker unit tests |
| Full | `npm run verify:full` | Quick checks, one production build, Python suite, security browser tests and complete E2E |
| Delivery | `npm run verify:delivery` | Real data contracts, pipeline registry and politics delivery reconciliation; may use the network |

Quick checks are the local floor. Add the relevant Python or browser tests for the
behavior you change. Documentation-only edits need copy and link review. Shared
frontend, routing, security and integration changes need Full. Data export or
delivery changes need Delivery as well. GitHub retains all required checks on PRs
and main, including real delivery checks; local scopes do not replace that gate.

Use `node scripts/verify.mjs full --plan` to inspect commands without running them.
Checks stop at the first failure. Logs and each Python run's isolated temporary
directory live under ignored `tmp/checks/`. The console shows status, elapsed time
and a short failure excerpt. A local Full run reuses its build for security tests.
Successful Python fixtures are removed from that run's own directory; failed
fixtures and all logs remain available for investigation.

Preflight checks disk space and existing dependencies without installing or deleting
anything. Quick requires 2 GiB free; Full and Delivery require 4 GiB. These are
starting thresholds, not storage quotas. Local Playwright uses one worker; CI uses
two. Set `PLAYWRIGHT_WORKERS` explicitly when resources permit. An existing browser
can be selected with `PLAYWRIGHT_CHROMIUM_PATH`.

Run expensive checks once per relevant change. Save detailed output in the logs;
do not paste successful test lists or large generated data into agent context.
Poll remote CI no more than once per minute and report only changed outcomes.

## Workspaces

`npm run workspaces` reports branch, dirty state and whether each HEAD is included
in the cached `origin/main`. It flags ignored local files without reading their
contents. It does not fetch, archive, reset or remove anything.
Refresh remote references before deciding what is merged. A retirement candidate
is a review prompt, not proof that an Orca terminal or editor is inactive.

Keep one integration branch for a task. Start new tasks from accepted main; do not
start from an old dirty workspace. Existing dirty workspaces retain their owners
and must not be reset or copied wholesale into a new task.

After a merge, confirm the exact commit on remote main, stop or park the owning
terminal, and inspect `git status` in the source workspace. Only then remove a
clean, unlocked, merged worktree with `git worktree remove <exact-path>`. Preserve
branches, uncommitted work and ignored local data. Review and preserve private
profiles, `.env` files and warehouses before removal; Git's clean state omits them.
Never use force removal as cleanup. Keep the primary
main checkout and any active workspace. A dependency installation may be reused
locally only when package-lock.json is identical; CI always installs from its lock.

## Skills and extraction

`CLAUDE.md` routes skills by the actual change. Keep upstream skill documents for
reference; loading every design guide is unnecessary for a markup-preserving move.
The approved visual direction remains in `docs/design-system.md` and `tokens.css`.

Split large files by responsibility as they are touched. Preserve public entrypoints,
markup, state ownership and failure behavior. For example, the projects page owns
composition while workflow history, ingestion records, pipeline tables and warehouse
inspection have their own modules. Verify the affected page on desktop and mobile.
