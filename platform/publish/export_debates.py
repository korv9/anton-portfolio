"""Debate statistics for the politics product's Debatter pages.

For every debate in the Riksdag since 1993/94 (issue debates, "sakdebatter", and party-leader
debates, "partiledardebatter"): who spoke, how many speeches and replies per party, and, for a
party-leader debate, who replied to whom. Read from the speech cards (one row per speech, in
order), so no speech text is needed.

Each debate is linked to what it was about:
- an issue debate whose title matches a Riksdag decision (the decision files published for
  2024/25 and later) gets the committee report (betänkande), its decision points with each
  party's position, and the issue area of the committee (parliament/issues.json);
- any debate gets issue areas from its title words, using the site's lexicon per expenditure
  area (gold/marts/budget-report.json). These are marked as word matches, not decisions.

Writes frontend/public/data/politics/parliament/debate-stats/index.json (sessions, all
party-leader debates, the lexicon by issue area) and one file per session with its issue
debates. Standard library and pyarrow only.

    python platform/publish/export_debates.py
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "frontend/public/data"
CARDS = DATA / "parquet/speech_cards"
OUT = DATA / "politics/parliament/debate-stats"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]
WORD = re.compile(r"[a-zåäöéü-]+")


def load(path: str):
    return json.loads((DATA / path).read_text(encoding="utf-8-sig"))


def issue_lexicon() -> tuple[dict[str, list[str]], dict[str, str], list[dict]]:
    """Keywords per issue area, the committee → issue map, and the issues themselves."""
    issues = load("parliament/issues.json")["issues"]
    lexicon = load("gold/marts/budget-report.json")["language"]["lexicon"]
    by_area: dict[int, list[str]] = defaultdict(list)
    for row in lexicon:
        by_area[int(row["expenditure_area"])].append(row["keyword"].lower())
    words = {
        i["issue_key"]: sorted({w for a in i["expenditure_areas"] for w in by_area.get(a, [])})
        for i in issues
    }
    committees = {c: i["issue_key"] for i in issues for c in i["committees"]}
    return words, committees, issues


def matches(word: str, keyword: str) -> bool:
    """The keyword itself, or with a short ending ("polisen"); the same rule as the site."""
    return word == keyword or (
        len(keyword) >= 4 and word.startswith(keyword) and len(word) - len(keyword) <= 4)


def areas_from_words(text: str, words: dict[str, list[str]]) -> list[str]:
    tokens = WORD.findall(text.lower())
    hits = Counter()
    for key, keywords in words.items():
        for token in tokens:
            if any(matches(token, k) for k in keywords):
                hits[key] += 1
    return [k for k, _ in hits.most_common(3)]


def clean_title(title: str) -> str:
    """Continuations are the same debate: '(forts. från § 13) X (forts. KrU2)' → 'x'."""
    t = re.sub(r"^\(forts\.[^)]*\)\s*", "", title.strip())
    t = re.sub(r"\s*\(forts\.[^)]*\)\s*$", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def decisions_by_title(session: str) -> dict[str, list[dict]]:
    path = DATA / f"politics/decisions/{session.replace('/', '-')}/index.json"
    if not path.exists():
        return {}
    out: dict[str, list[dict]] = defaultdict(list)
    for d in json.loads(path.read_text(encoding="utf-8")):
        out[clean_title(d["title"])].append(d)
    return out


def exchanges(rows: list[dict]) -> tuple[list[list[str]], dict[str, Counter]]:
    """Reply pairs [replier, target] in order, and replies per party per target party.

    A debate is a run of main speeches, each followed by its replies: others reply to the main
    speaker, and the main speaker answers each of them in turn.
    """
    pairs: list[list[str]] = []
    matrix: dict[str, Counter] = defaultdict(Counter)
    main = None
    last_other = None
    for row in rows:
        if not row["is_reply"]:
            main, last_other = row, None
            continue
        if not main or not row["party"] or not main["party"]:
            continue
        if row["speaker"] != main["speaker"]:
            target, last_other = main, row
        else:
            target = last_other
        if target and target["party"]:
            pairs.append([row["party"], target["party"]])
            matrix[row["party"]][target["party"]] += 1
    return pairs, matrix


def main() -> None:
    words, committees, issues = issue_lexicon()
    by_session: dict[str, list[dict]] = defaultdict(list)
    for part in sorted(CARDS.glob("session=*/*.parquet")):
        for row in pq.read_table(part).to_pylist():
            by_session[row["session"]].append(row)

    OUT.mkdir(parents=True, exist_ok=True)
    sessions = []
    leaders = []
    for session in sorted(by_session):
        rows = by_session[session]
        decisions = decisions_by_title(session)
        groups: dict[tuple, list[dict]] = defaultdict(list)
        for row in rows:
            key = (row["kind"], row["path"], row["first"] if row["kind"] == "issues" else None)
            groups[key].append(row)
        issue_debates = []
        for (kind, path, first), speeches in groups.items():
            speeches.sort(key=lambda r: r["speech_number"])
            per_party: dict[str, list[int]] = {}
            for s in speeches:
                if s["party"] in PARTIES:
                    counts = per_party.setdefault(s["party"], [0, 0])
                    counts[1 if s["is_reply"] else 0] += 1
            protocol = path.rsplit("/", 1)[-1].removesuffix(".json").upper()
            entry = {
                "id": f"{protocol}-{first}" if kind == "issues" else protocol,
                "path": "politics/parliament/" + path,
                "title": speeches[0]["title"].strip(),
                "date": min(s["speech_date"] for s in speeches),
                "speeches": len(speeches),
                "replies": sum(1 for s in speeches if s["is_reply"]),
                "parties": per_party,
            }
            if kind == "leaders":
                pairs, matrix = exchanges(speeches)
                entry["session"] = session
                entry["replied_to"] = {a: dict(c) for a, c in matrix.items()}
                leaders.append(entry)
                continue
            entry["first"] = first
            entry["last"] = speeches[0]["last"]
            match = decisions.get(clean_title(entry["title"]))
            if match:
                designation = match[0]["designation"]
                committee = re.match(r"[A-Za-zÅÄÖåäö]+", designation).group(0)
                entry["decision"] = {
                    "designation": designation,
                    "committee": committee,
                    "date": match[0]["date"],
                    "points": [
                        {
                            "id": d["id"],
                            "heading": d["heading"],
                            "point": d["point"],
                            "positions": {
                                p["party"]: p["party_position"]
                                for p in d["parties"]
                                if p["party"] in PARTIES
                            },
                        }
                        for d in sorted(match, key=lambda d: d["point"] or 0)
                    ],
                }
                issue = committees.get(committee)
                entry["issues"] = [issue] if issue else []
                entry["issues_via"] = "beslut"
            else:
                entry["issues"] = areas_from_words(entry["title"], words)
                entry["issues_via"] = "ord"
            issue_debates.append(entry)
        issue_debates.sort(key=lambda d: (d["date"], d["first"] or 0))
        name = session.replace("/", "-")
        (OUT / f"{name}.json").write_text(
            json.dumps({"session": session, "debates": issue_debates}, ensure_ascii=False,
                       separators=(",", ":")),
            encoding="utf-8",
        )
        sessions.append({
            "session": session,
            "path": f"politics/parliament/debate-stats/{name}.json",
            "debates": len(issue_debates),
            "speeches": sum(d["speeches"] for d in issue_debates),
            "replies": sum(d["replies"] for d in issue_debates),
            "linked_to_decisions": sum(1 for d in issue_debates if "decision" in d),
        })

    leaders.sort(key=lambda d: d["date"])
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": ("Counts from the speech cards. Decision links match debate titles to the Riksdag's "
                 "decisions (published for 2024/25 on); other issue areas are word matches against "
                 "the expenditure-area lexicon."),
        "sessions": sessions,
        "leaders": leaders,
        "issues": [
            {"key": i["issue_key"], "sv": i["issue_name_sv"], "en": i["issue_name_en"],
             "committees": i["committees"], "words": words[i["issue_key"]]}
            for i in issues
        ],
    }
    (OUT / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    linked = sum(s["linked_to_decisions"] for s in sessions)
    print(f"{len(sessions)} sessions, {sum(s['debates'] for s in sessions)} issue debates "
          f"({linked} linked to decisions), {len(leaders)} party-leader debates -> {OUT}")


if __name__ == "__main__":
    main()
