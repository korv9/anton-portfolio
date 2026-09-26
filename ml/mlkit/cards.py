"""Model cards and run reports.

A card is the evidence a result is allowed to be shown at all. It records what the model
learned from, what the label actually means, how it was split, what it beat, and what it
cannot support. The limitations section is required and may not be empty.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS = ROOT / "ml/cards"


def write_card(task: str, run_id: str, card: dict) -> Path:
    required = ("purpose", "label_meaning", "data", "split", "baselines",
                "headline", "gate", "limitations")
    missing = [field for field in required if not card.get(field)]
    if missing:
        raise ValueError(f"Model card for {task} is missing: {', '.join(missing)}")

    lines = [
        f"# {card['purpose']}",
        "",
        f"Task `{task}` · run `{run_id}` · gate **{'passed' if card['gate']['passed'] else 'FAILED'}**",
        "",
        "## What the label means",
        "",
        card["label_meaning"],
        "",
        "## Data",
        "",
    ]
    lines += [f"- {key}: {value}" for key, value in card["data"].items()]
    lines += ["", "## Split", "", card["split"], "", "## Results", "",
              "| Model | Metric | Value | 95% CI |", "|---|---|---|---|"]
    for row in card["baselines"] + card.get("also", []) + [card["headline"]]:
        interval = (f"{row['low']:.3f} – {row['high']:.3f}"
                    if row.get("low") is not None else "—")
        lines.append(f"| {row['name']} | {row['metric']} | {row['value']:.3f} | {interval} |")
    lines += ["", "## Gate", "", card["gate"]["rule"], "",
              f"Outcome: **{'passed' if card['gate']['passed'] else 'failed'}**. "
              f"{card['gate'].get('detail', '')}", "",
              "## Limitations", ""]
    lines += [f"- {item}" for item in card["limitations"]]
    lines += ["", "## Reproducing", "",
              "```bash", "cd ml && python -m mlkit.overnight --only " + task, "```", ""]

    CARDS.mkdir(parents=True, exist_ok=True)
    path = CARDS / f"{task}.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_report(run_dir: Path, results: list[dict], started: str, elapsed: float) -> Path:
    """The morning report: what ran, what it cost, what passed."""
    passed = sum(1 for r in results if r.get("gate", {}).get("passed"))
    failed = [r for r in results if r.get("status") == "failed"]
    lines = [
        "# Overnight run", "",
        f"Started {started} · {elapsed / 60:.0f} min · "
        f"{passed}/{len(results)} gates passed · {len(failed)} job(s) errored", "",
        "| Task | Status | Headline | Baseline | Gate | Device | Minutes |",
        "|---|---|---|---|---|---|---|",
    ]
    def number(value):
        return f"{value:.3f}" if isinstance(value, (int, float)) else "—"

    for result in results:
        gate = result.get("gate") or {}
        verdict = "pass" if gate.get("passed") else "fail" if gate else "—"
        lines.append(
            f"| {result['task']} | {result['status']} "
            f"| {number((result.get('headline') or {}).get('value'))} "
            f"| {number((result.get('best_baseline') or {}).get('value'))} "
            f"| {verdict} | {result.get('device', '—')} "
            f"| {result.get('minutes', 0):.0f} |"
        )
    if failed:
        lines += ["", "## Errors", ""]
        for result in failed:
            lines += [f"### {result['task']}", "", "```", result.get("error", "")[:2000], "```", ""]
    partial = [r for r in results if r.get("status") == "partial"]
    if partial:
        lines += ["", "## Partial", ""]
        lines += [f"- {r['task']}: {r.get('note', '')}" for r in partial]
    lines += ["", "Nothing here is published. Promotion is a deliberate, manual step for a "
              f"passing run (`{run_dir.name}`); see open question 4 in "
              "docs/plans/ml-layer-plan.md.", ""]
    path = run_dir / "report.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    (run_dir / "results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    return path
