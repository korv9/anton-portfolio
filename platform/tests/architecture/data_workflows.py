"""Read a data workflow as GitHub runs it: a caller of data-subject.yml gets the called jobs,
with the caller's inputs filled in and the job env they set substituted into the run lines."""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github/workflows"
REUSABLE = "./.github/workflows/data-subject.yml"
INPUT = re.compile(r"\$\{\{\s*inputs\.([\w-]+)\s*\}\}")


def called(values: dict) -> dict:
    text = (WORKFLOWS / "data-subject.yml").read_text(encoding="utf-8")
    declared = yaml.safe_load(text)[True]["workflow_call"]["inputs"]
    assert set(values) <= set(declared), f"undeclared inputs: {set(values) - set(declared)}"
    values = {name: values.get(name, spec.get("default", "")) for name, spec in declared.items()}
    jobs = yaml.safe_load(INPUT.sub(lambda m: str(values[m[1]]), text))["jobs"]
    for job in jobs.values():
        plain = {k: str(v) for k, v in job.get("env", {}).items() if "${{" not in str(v)}
        for step in job["steps"]:
            if "run" in step:
                step["run"] = re.sub(r"\$(\w+)\b", lambda m: plain.get(m[1], m[0]), step["run"])
    return jobs


def workflow(filename: str) -> dict:
    config = yaml.safe_load((WORKFLOWS / filename).read_text(encoding="utf-8"))
    if any(job.get("uses") == REUSABLE for job in config["jobs"].values()):
        (job,) = config["jobs"].values()
        config["jobs"] = called(job.get("with", {}))
    return config
