"""Verify curated appointment ballots against immutable official source snapshots."""
from __future__ import annotations

import argparse
import csv
import hashlib
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SEEDS = ROOT / "platform/seeds/parliament"


def verify(raw: Path) -> int:
    from pypdf import PdfReader

    parties = list(csv.DictReader((SEEDS / "prime_minister_party_votes.csv").open(encoding="utf-8")))
    ballots = list(csv.DictReader((SEEDS / "prime_minister_ballots.csv").open(encoding="utf-8")))
    raw.mkdir(parents=True, exist_ok=True)
    for ballot in ballots:
        url = ballot["source_url"]
        if not url.startswith(("https://www.riksdagen.se/", "https://data.riksdagen.se/")):
            raise ValueError("Ballot source must be an official parliamentary source")
        path = raw / (ballot["vote_key"] + (".pdf" if url.endswith(".pdf") else ".html"))
        if not path.exists():
            with urllib.request.urlopen(url, timeout=60) as response:
                path.write_bytes(response.read())
        if hashlib.sha256(path.read_bytes()).hexdigest() != ballot["source_sha256"]:
            raise ValueError(f"Source changed; review before replacing {path.name}")
        rows = [r for r in parties if r["vote_key"] == ballot["vote_key"]]
        for column in ("yes", "no", "abstain", "absent"):
            if sum(int(r[column]) for r in rows) != int(ballot["recorded_" + column]):
                raise ValueError(f"Ballot totals disagree: {path.name}, {column}")
        if ballot["extraction"] == "pdf_table":
            text = PdfReader(path).pages[0].extract_text().split("Plats Ledamot")[0]
            parsed = {m[0]: list(map(int, m[1:])) for m in re.findall(
                r"(?<![A-Z])(SD|KD|MP|FP|S|M|C|V|L|-)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)", text)}
            expected = {r["source_party"]: [int(r[c]) for c in ("yes", "no", "abstain", "absent")] for r in rows}
            if parsed != expected:
                raise ValueError(f"PDF table disagrees with reviewed seed: {path.name}")
    return len(ballots)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=ROOT / "warehouse/raw/riksdagen/formation_votes")
    args = parser.parse_args()
    print(f"Verified {verify(args.raw)} official prime minister ballots")
