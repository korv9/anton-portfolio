"""Publish a run's aggregate results to the site, deliberately and one run at a time.

    python -m mlkit.promote <run_id>

For every task in the run that finished and passed its gate, the aggregate output is written
to frontend/public/data/ml/<task>.json. A task that failed its gate, or ran only partly, is
refused and named. The model register (ml/models.json) is rebuilt from the committed cards
every time, so the site shows each model's current verdict, passed or not, with a link to
its card.

Only aggregates are published: per session and party, never per speech, speaker or advert.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "ml/runs"
CARDS = ROOT / "ml/cards"
OUT = ROOT / "frontend/public/data/ml"
CARD_URL = "https://github.com/korv9/anton-portfolio/blob/main/ml/cards/{task}.md"


def _polarization(job_dir: Path, result: dict) -> dict:
    detail = json.loads((job_dir / "per_session.json").read_text(encoding="utf-8"))
    sessions = []
    for session, row in sorted(detail["tfidf"].items()):
        sessions.append({
            "session": session,
            "all_parties_auc": round(row["mean_auc"], 4),
            "seven_parties_auc": round(row["core_auc"], 4) if "core_auc" in row else None,
            "within_debate_auc": (round(row["core_within_debate_auc"], 4)
                                  if "core_within_debate_auc" in row else None),
            "parties": row["parties"],
            "governing_parties": row["governing_parties"],
            "passages": row["passages"],
            "permutation_p": row["permutation_p"],
        })
    return {
        "sessions": sessions,
        "eras": detail.get("eras"),
        "trend_per_session": {"all_parties": detail.get("trend"),
                              "seven_parties": detail.get("core_trend"),
                              "within_debate": detail.get("topic_trend")},
        "core_parties": detail.get("core_parties"),
        "bert": detail.get("bert") or None,
    }


PAYLOADS = {"polarization": _polarization}


def read_card(path: Path) -> dict:
    """The verdict and headline of a card written by cards.write_card."""
    text = path.read_text(encoding="utf-8")
    title = text.splitlines()[0].lstrip("# ").strip()
    header = re.search(r"Task `([^`]+)` · run `([^`]+)` · gate \*\*(\w+)\*\*", text)
    rows = re.findall(r"^\| ([^|]+) \| ([^|]+) \| ([\d.]+) \| ([^|]+) \|$", text, re.M)
    results = [{"model": m.strip(), "metric": k.strip(), "value": float(v),
                "interval": i.strip() if i.strip() != "—" else None}
               for m, k, v, i in rows if m.strip() != "Model"]
    limitations = re.search(r"## Limitations\n\n(.*?)\n\n##", text, re.S)
    return {
        "task": header.group(1), "run_id": header.group(2),
        "gate_passed": header.group(3) == "passed", "purpose": title,
        "results": results,
        "limitations": [line[2:] for line in (limitations.group(1).splitlines()
                                              if limitations else []) if line.startswith("- ")],
        "card_url": CARD_URL.format(task=header.group(1)),
    }


def write(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True,
                               separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("run_id")
    arguments = parser.parse_args()
    run_dir = RUNS / arguments.run_id
    if not run_dir.is_dir():
        raise SystemExit(f"No run {arguments.run_id} in {RUNS}")

    promoted = []
    for result_path in sorted(run_dir.glob("*/result.json")):
        result = json.loads(result_path.read_text(encoding="utf-8"))
        task = result["task"]
        if result.get("status") != "ok" or not (result.get("gate") or {}).get("passed"):
            print(f"  {task}: not promoted (status {result.get('status')}, gate "
                  f"{'passed' if (result.get('gate') or {}).get('passed') else 'not passed'})")
            continue
        if task not in PAYLOADS:
            print(f"  {task}: passed, but has no published output defined")
            continue
        payload = PAYLOADS[task](result_path.parent, result)
        payload.update({"task": task, "run_id": arguments.run_id, "gate": result["gate"],
                        "headline": result["headline"],
                        "promoted_at": datetime.now(timezone.utc).isoformat(timespec="minutes")})
        write(OUT / f"{task}.json", payload)
        promoted.append(task)
        print(f"  {task}: promoted to {OUT.relative_to(ROOT) / (task + '.json')}")

    register = [read_card(path) for path in sorted(CARDS.glob("*.md"))]
    for entry in register:
        entry["published"] = (OUT / f"{entry['task']}.json").is_file()
    write(OUT / "models.json", register)
    print(f"register: {len(register)} models; promoted {promoted or 'nothing'}")


if __name__ == "__main__":
    main()
