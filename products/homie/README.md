# Homie API

Homie is a household chore-tracking app. This repository contains its independently
deployed Python API and PostgreSQL database. The Vite/React/TypeScript frontend lives
in `theazero/Homie` and is maintained separately.

The first milestone is an explicit, usable API contract. Authentication and database
health are implemented; household, task, completion and analytics operations are
documented stubs. Stub writes return previews and **do not persist changes**.

## Local quickstart

Install Docker with Compose, then run from this directory:

```sh
cp .env.example .env
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python -m seed.generate_history
```

PowerShell users can use `Copy-Item .env.example .env` for the first command.
The API runs at http://localhost:8000; interactive docs are at `/docs`.
`/health` performs `SELECT 1` and returns HTTP 503 while PostgreSQL is unavailable.
Compose waits for PostgreSQL connectivity, but migrations are deliberately explicit.

The seed is transactional and idempotent: it creates the `homie-demo` household only
once, protected by an advisory lock, then refreshes all materialized views on every
run. A fixed RNG seed generates approximately 180 days of history relative to the
first execution date. Alex does about 60% of chores, Sam 28%, and Robin 12%, with
evening/weekend patterns, varied durations, and neglected windows/oven tasks.
Run it only in a demo/development database. Demo login:

```json
{"email":"alex@demo.example.com","password":"demo-password-change-me"}
```

Use `POST /auth/login`, then paste the returned token into Swagger's **Authorize**
dialog. Sam and Robin use the corresponding first-name email and same password.
Freshly registered members have no household and receive 403 on scoped routes.
Because create/join are stubs, use a seeded member to exercise those routes today.

## API contract

`/openapi.json` is the source of truth for the frontend client. A generated snapshot
is also committed as `openapi.json` for immediate handoff. Generate types, for
example, with `npx openapi-typescript http://localhost:8000/openapi.json -o api.d.ts`
in the frontend repository. Responses are objects; collections have an `items` key.
IDs are integers. Times are UTC and inputs must include a timezone. Tokens travel
only in the `Authorization: Bearer ...` header; no cookies are used.

| Method | Path | Status |
|---|---|---|
| GET | `/health` | Implemented: database check |
| POST | `/auth/register` | Implemented: Argon2, 201 token, 409 duplicate email |
| POST | `/auth/login` | Implemented: JSON credentials, bearer token |
| GET | `/auth/me` | Implemented: current member |
| POST | `/households` | Stub preview |
| GET | `/households/me` | Stub sample |
| POST | `/households/{id}/join` | Stub: accepts `homie-demo` invite code |
| GET, POST | `/tasks` | Stub list/create preview |
| PATCH | `/tasks/{id}` | Stub update preview |
| POST | `/completions` | Stub event preview |
| GET | `/completions?limit=50&offset=0` | Stub pagination, limit 1–100 |
| GET | `/analytics/workload?weeks=12` | Stub weekly per-member minutes |
| GET | `/analytics/fairness?weeks=12` | Stub weekly balance |
| GET | `/analytics/cadence` | Stub completion intervals and overdue flags |
| GET | `/analytics/heatmap?weeks=12` | Stub UTC weekday/hour buckets |

Analytics `weeks` accepts 1–104. Deterministic fixtures are anchored to 2026-09-07,
independent of seed history. Workload uses the current member plus synthetic member
IDs -1 and -2; these are fixture identities, not database members. Zero-activity
heatmap buckets are omitted. Household resolution is centralized in
`get_current_household`; create/join only require authentication because they must
be reachable before a member belongs to a household. Stub task IDs are 1, 2 and 3.

Timer requests include `source: "timer"`, `task_id`, `started_at`, and `ended_at`.
Manual requests include `source: "manual"`, `task_id`, `ended_at`, and positive
`duration_sec` (at most seven days); the API computes `started_at` backwards.
Both accept an optional `note`. PATCH distinguishes omitted fields from explicitly
clearing `recurrence_days`; other task fields cannot be explicitly null.

## Data architecture

```mermaid
flowchart TD
    A[Layer 1: chore_completion — immutable events] --> B[Layer 2: v_completion_enriched]
    B --> C[Layer 3: mv_workload_week]
    C --> D[Layer 3: mv_fairness_week]
    B --> E[Layer 3: mv_task_cadence]
    B --> F[Layer 3: mv_category_split]
    B --> G[Layer 3: mv_completion_heatmap]
    C --> API[Future analytics queries]
    D --> API
    E --> API
    F --> API
    G --> API
```

Events have a stored generated duration and a `BEFORE UPDATE OR DELETE` trigger
that rejects mutation. No soft deletion or event editing is supported.
The intentionally denormalized `household_id` supports tenant filtering and the
`(household_id, started_at DESC)` index. All aggregation SQL is centralized in
`app/analytics/queries.py`; analytics handlers must never query raw events.
The heatmap materialized view is an addition needed to preserve that boundary.

Every materialized view has a unique index. The refresh helper uses concurrent
refreshes in dependency order, with workload before fairness. Seed invokes it after
commit. A future persisted completion handler must invoke it after its insert
commits; the current stub neither inserts nor refreshes. Move this work to a
background/scheduled job before production. Concurrent refreshes are sequential,
not one atomic snapshot across all views; cadence age stays fixed until refreshed.
Cadence currently includes only tasks with at least one completion.

For each household/week:

```text
balance_index = 1 - sum(abs(share_i - 1/n)) / (2 * (1 - 1/n))
```

Here `share_i` is a member's fraction of total minutes and `n` counts members with
at least one completion that week. One means an even distribution and zero means
complete concentration. For one contributing member the result is NULL, because
the denominator is zero. Members with no completions are excluded by this
definition, so it measures balance among contributors, not all household members.
Empty weeks produce no rows. Week, weekday and hour grouping is explicitly UTC.
The enriched view joins current task metadata, so later task edits can change
historical categorization/effort estimates even though the events remain immutable.

## Development and testing

Python 3.12 and PostgreSQL 16 are the target runtime. Using a recent pip:

```sh
python -m venv .venv
# Activate .venv for your shell.
python -m pip install --upgrade pip
pip install -e . --group dev
ruff check .
ruff format --check .
pytest
```

Tests use `DATABASE_URL` when supplied, otherwise `homie_test` on localhost. Create
a dedicated test database and migrate it before running the integration suite:

```sh
docker compose exec postgres createdb -U homie homie_test
export DATABASE_URL=postgresql+psycopg://homie:homie@localhost:5432/homie_test
alembic upgrade head
pytest
```

In PowerShell set `$env:DATABASE_URL` instead of `export`. Auth tests create unique
test members; append-only tests roll back their transactions. CI uses a fresh
PostgreSQL 16 service, migrates, seeds twice, then runs the full suite. Contract
checks can run without PostgreSQL: `pytest tests/test_contract.py`.

Configuration comes through `pydantic-settings`: `DATABASE_URL`, `JWT_SECRET`
(minimum 32 characters), `ACCESS_TOKEN_MINUTES` (default 60), and comma-separated
`CORS_ORIGINS` (default `http://localhost:5173`). `.env` is ignored. Example/Compose
credentials are for local development; supply a random JWT secret in deployment.
The non-root, multi-stage Docker image honors `PORT`. Apply migrations as a release
step when deploying to Render or another independent API host.

## Initial verification on this workstation

Contract tests, schema generation, and Ruff checks were executed locally. Docker
and PostgreSQL are not installed here. Compose startup was attempted but the
command was unavailable; migration, seed and integration tests could not connect
to PostgreSQL. Database SQL and container behavior still require the documented
Compose/CI run. Do not treat the scaffold as database-verified yet.
