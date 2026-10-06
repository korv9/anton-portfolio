"""The workflow that stores the warehouse in R2 (.github/workflows/build-warehouse.yml) must
build every subject and run every ML stage whose output dbt reads, so nothing on the site rests
on files that exist only on one machine."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/architecture"))

import registry  # noqa: E402

WORKFLOW = (ROOT / ".github/workflows/build-warehouse.yml").read_text(encoding="utf-8")

# Tags built inside a wrapper the workflow calls, or deliberately elsewhere, with the reason.
ELSEWHERE = {
    "parliament": "platform/ingest/run_parliament.py builds tag:parliament",
    "welfare": "platform/ingest/run_welfare.py builds tag:welfare",
    "serving": "part of the welfare build",
    "taxes": "platform/ingest/run_taxes.py builds tag:taxes",
    "jobs": "the job-ad detail models are built by the jobs pipeline, not stored here yet",
}
WRAPPERS = {"parliament": "run_parliament.py", "welfare": "run_welfare.py", "serving": "run_welfare.py",
            "taxes": "run_taxes.py"}


def dbt_tags() -> set[str]:
    text = (ROOT / "platform/dbt_project.yml").read_text(encoding="utf-8")
    return {t.strip() for group in re.findall(r"\+tags: \[([^\]]+)\]", text) for t in group.split(",")}


def test_every_dbt_subject_is_built_before_the_warehouse_is_stored():
    store = WORKFLOW.index("warehouse_store.py push")
    for tag in sorted(dbt_tags()):
        if tag in ELSEWHERE:
            if tag in WRAPPERS:
                assert WRAPPERS[tag] in WORKFLOW[:store], f"{tag}: {ELSEWHERE[tag]}"
            continue
        at = WORKFLOW.find(f"tag:{tag}")
        assert 0 <= at < store, f"tag:{tag} is not built in build-warehouse.yml"


def test_every_ml_stage_that_feeds_dbt_runs_or_is_restored():
    assert "pull --only features" in WORKFLOW
    for stage in registry.ML:
        if not any(r.endswith("_features") for r in stage.get("raw", [])):
            continue
        assert stage["path"] in WORKFLOW, f"{stage['id']} ({stage['path']}) is not in build-warehouse.yml"


def test_every_new_source_is_ingested():
    for script in ["eu_ai_act/run.py", "riksdagen/ingest_speeches.py", "symbolic/ingest_corpus.py",
                   "philosophy/ingest_corpus.py", "jobtech/ingest_governance_terms.py"]:
        assert f"platform/ingest/{script}" in WORKFLOW, script
