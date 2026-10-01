"""Precompute the issue-debate analysis per party: what each party's utterances are about, every
riksmöte since 1993/94, and which words it uses, the latest riksmöten, in a form the site can
filter by party, topic and period and compare against the other parties.

- topics: per riksmöte and party, the debates the party spoke in, its utterances (speeches and
  replies), and their weight per issue area. A debate's issue area comes from the committee that
  prepared its decision (or from words in its title); a debate with two areas gives each half.
- terms: per riksmöte (the latest four) and party, its words (stems, stop words left out) and the
  counts of its 1,200 most used stems; and per riksmöte the count of every one of those stems over
  all parties, so the site can compare a party with the others (per 10,000 words, log-odds).
  Names are left out: every word of a member's or speaker's name.

Reads the debate statistics (local) and the speech shards (R2 or local) through the delivery and
writes frontend/public/data/politics/parliament/sakdebatter.json.

    python platform/publish/issue_debates.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform/lib"))
sys.path.insert(0, str(ROOT / "platform/nlp"))
import delivery  # noqa: E402
from issue_lexicon import STEM, WORD, stems  # noqa: E402

PUBLIC = ROOT / "frontend/public/data"
OUT = PUBLIC / "politics/parliament/sakdebatter.json"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]
TERM_SESSIONS = 4
TOP = 1200
ARTIFACTS = {"mergeformat", "styleref", "kantrubrik", "charformat", "pageref", "hyperlink"}


def topic_weights(debates: list[dict]) -> dict:
    """Per party: debates spoken in, utterances, and utterances per issue area (split evenly
    over a debate's areas)."""
    out: dict[str, dict] = {}
    for d in debates:
        issues = d.get("issues") or []
        for p, counts in (d.get("parties") or {}).items():
            if p not in PARTIES:
                continue
            n = sum(counts)
            if not n:
                continue
            row = out.setdefault(p, {"debates": 0, "utterances": 0, "topics": defaultdict(float)})
            row["debates"] += 1
            row["utterances"] += n
            for issue in issues:
                row["topics"][issue] += n / len(issues)
    return {
        p: {**r, "topics": {k: round(v, 2) for k, v in sorted(r["topics"].items(), key=lambda x: -x[1])}}
        for p, r in out.items()
    }


def term_tables(rows: list[tuple[str, str]], names: set[str], top: int = TOP):
    """From (party, text) rows: per party its words and top stems; and the count of every kept
    stem over all parties."""
    per_party: dict[str, Counter] = defaultdict(Counter)
    for party, text in rows:
        per_party[party].update(s for s in stems(text) if s not in names)
    kept = set()
    parties = {}
    for p, c in per_party.items():
        common = [(s, n) for s, n in c.most_common(top) if n >= 3]
        kept |= {s for s, _ in common}
        parties[p] = {"words": sum(c.values()), "stems": dict(common)}
    total = Counter()
    for c in per_party.values():
        total.update({s: n for s, n in c.items() if s in kept})
    return parties, {"words": sum(sum(c.values()) for c in per_party.values()), "stems": dict(total)}


def main() -> int:
    index = json.loads((PUBLIC / "politics/parliament/debate-stats/index.json").read_text(encoding="utf-8"))
    sessions = index["sessions"]

    topics = []
    files = {}
    for s in sessions:
        data = json.loads((PUBLIC / s["path"]).read_text(encoding="utf-8"))
        files[s["session"]] = data
        topics.append({"session": s["session"], "debates": len(data["debates"]),
                       "parties": topic_weights(data["debates"])})

    # Names are not terms.
    story = json.loads((PUBLIC / "politics/parliament/story.json").read_text(encoding="utf-8"))
    name_words = {w for m in story["members"] for w in WORD.findall(m["name"].lower())}
    for d in story["leader_debates"]:
        for row in d["parties"].values():
            for sp in row["speakers"]:
                name_words |= set(WORD.findall(sp.lower()))
    names = {STEM.stemWord(w) for w in name_words if len(w) >= 3} | {STEM.stemWord(w) for w in ARTIFACTS}

    terms = []
    forms: dict[str, Counter] = defaultdict(Counter)
    for s in sessions[-TERM_SESSIONS:]:
        data = files[s["session"]]
        paths = sorted({d["path"] for d in data["debates"]})
        with ThreadPoolExecutor(delivery.workers()) as pool:
            shards = dict(zip(paths, pool.map(lambda p: json.loads(delivery.read_bytes(p)), paths)))
        rows = []
        for d in data["debates"]:
            for r in shards[d["path"]]["data"]:
                if r.get("party") in PARTIES and r.get("speech_text") and d["first"] <= int(r["speech_number"]) <= d["last"]:
                    rows.append((r["party"], r["speech_text"]))
        for _, text in rows[:20000]:
            for w in WORD.findall(text.lower()):
                if len(w) >= 3:
                    forms[STEM.stemWord(w)][w] += 1
        parties, total = term_tables(rows, names)
        terms.append({"session": s["session"], "parties": parties, "total": total})
        print(f"{s['session']}: {len(rows):,} speeches, {total['words']:,} words, {len(total['stems']):,} stems")

    kept = {s for t in terms for s in t["total"]["stems"]}
    words = {s: forms[s].most_common(1)[0][0] for s in kept if forms.get(s)}

    OUT.write_text(
        json.dumps(
            {
                "method": {
                    "topics": "Per riksmöte and party: debates spoken in, utterances (speeches and replies) and utterances per issue area, a debate's utterances split evenly over its areas. The area comes from the committee that prepared the decision, or from words in the debate's title.",
                    "terms": "Per riksmöte and party: Snowball stems without stop words or names, the party's 1,200 most used (at least 3 times), and every kept stem's count over all parties.",
                },
                "issues": index["issues"],
                "topics": topics,
                "terms": terms,
                "words": words,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} kB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
