# Job Intelligence: compliance subsystem

The public workspace is now **Job Intelligence**. See the [workspace architecture and delivery contract](../job-intelligence.md). Existing compliance routes, research cohort, internal module names and publication safeguards remain in place.

Phase 0 audit, Phase 1 registry, Phase 2 collection, Phase 3 evidence review and
Phase 4 analytics and Phase 5 explorer/export,
checked through 2026-10-17. Register acquisition, identity resolution, frozen cohort
exports, private source adapters and evidence-bound review/export are implemented.
SCB acquisition now contains 62,113 source rows and a verified frozen sample of
50 companies from 43,836 eligible active Swedish limited companies, as of
2026-10-17. The sample is private research, pending human source-reuse/publication
clearance. IMY collection has expanded; KKV still returns HTTP 403. No real legal
record has human approval. See [current completion and handoff](completion.md)
and [aggregate status](completion-status.json) for that processing batch. The later
[KKV alternative assessment](kkv-alternative.md) documents the 50-company search,
independent court supplements, local import and KKV ranking hold.

The module will describe documented proceedings and outcomes for a frozen cohort of
50 Swedish IT legal entities. Every published statement must identify its source,
the entity concerned, its legal category and the date through which it was verified.
An administrative sanction is not a criminal conviction. Missing records mean
unknown coverage, never a clean bill of health.

| Deliverable | Document |
| --- | --- |
| Current real cohort, processing results, blockers and exact review commands | [Completion and handoff](completion.md) |
| Actual repository, reusable code, deployment and tests | [Repository audit](repository-audit.md) |
| Storage boundaries, entity identity, cohort and lifecycle | [Architecture](architecture.md) |
| Official sources, access, history and reuse conditions | [Source feasibility](source-feasibility.md) |
| Table grain, fields, enums and validation responsibilities | [Data dictionary](data-dictionary.md) |
| Publication review, privacy and operational risks | [Risks](risks.md) |
| Exact next-phase scope, inputs, outputs and acceptance criteria | [Phase 1 handoff](phase-1-handoff.md) |
| Checks and files added by this task | [Validation](validation.md) |
| SCB access, CSV/Parquet fallback, identity matching and cohort commands | [Phase 1 operation](phase-1.md) |
| Current implementation checks and remaining input dependency | [Phase 1 validation](phase-1-validation.md) |
| Authority adapters, current access/terms, private storage and cohort expansion | [Phase 2 operation](phase-2.md) |
| Live pilot coverage, checks, limitations and changed files | [Phase 2 validation](phase-2-validation.md) |
| Fixed pilot URLs and baseline hashes | [Phase 2 pilot manifest](phase-2-pilot-manifest.json) |
| Structured extraction, lifecycle, human review and Gold gates | [Phase 3 operation](phase-3.md) |
| Real evidence coverage, adversarial checks and handoff | [Phase 3 validation](phase-3-validation.md) |
| Aggregate coverage and review counts | [Phase 3 summary](phase-3-summary.json) |
| Approved-only analytical build, filtering and validation | [Phase 4 operation](phase-4.md) |
| Public metric definitions, comparison limits and missingness | [Phase 4 methodology](phase-4-methodology.md) |
| Analytical checks, actual readiness and remaining dependencies | [Phase 4 validation](phase-4-validation.md) |
| Aggregate analytical readiness | [Phase 4 summary](phase-4-summary.json) |
| Four explorer views, public review gate and research export | [Phase 5 operation](phase-5.md) |
| Browser, security, build checks and current public readiness | [Phase 5 validation](phase-5-validation.md) |
| Job advertisements, canonical profiles, matching, API and deployment | [Job/company integration](job-company-integration.md) |
| Live match coverage, test results and changed files | [Job/company validation](job-company-validation.md) |

The executable foundation is
[`schema.sql`](../../platform/compliance_intelligence/schema.sql) and
[`contracts.py`](../../platform/compliance_intelligence/contracts.py). It creates
13 empty tables in an isolated, in-memory DuckDB database. It also defines an
original-document interface. The Phase 1 CLI acquires register data only;
the separate Phase 2 CLI collects authority documents into a private database.
Run the offline checks:

```sh
python -m pytest platform/tests/compliance_intelligence -q
```

No company violation or reviewed legal outcome has been asserted by these tasks.
Phase 2 has observed real source documents without interpreting their outcomes. Test
records are synthetic and use temporary test directories. Private compliance
processing is separate from scheduled public data publishing. The explorer and
canonical company routes reuse the existing frontend; the job/company projection
uses the existing jobs delivery group. The homepage and intro animations are
outside this change.

The schema now supports a private Phase 1 registry database. The application creates
immutable cohort bundles, verifies their hashes and provides conservative identity
resolution. It is not a production warehouse migration or publication gate.
Phase 3 adds private evidence review and gated release staging. Actual human
approvals and public delivery remain pending; the real pilot has no approved rows.
Phase 4 has built six private analytical tables against the real frozen cohort.
The 50 company summary rows have unassessed metrics; legal fact tables are empty
because no real decision has been approved. Empty facts do not mean no sanctions.
Phase 5 adds `#compliance` to the portfolio, with an explicit public unavailable
state. Exact-artifact human approval is required to replace that state with real
company observations. Aggregate collection/review progress can be shown separately
without publishing company findings. No actual outcomes were approved or uploaded.
