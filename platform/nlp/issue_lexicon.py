"""Learn the issue-area lexicon from debates whose subject is known, instead of writing it by hand.

Debates linked to a committee decision have a known issue area (the committee that prepared
it). Every speech in them is a labelled example, which is "distant supervision": no one labels
anything, and no language model is needed. From those speeches this script learns, per area,
the word stems that set it apart from the other areas (log-odds ratio with an informative
Dirichlet prior, Monroe, Colaresi & Quinn 2008), keeps the strongest, and writes them with their
weights for the site to score any speech, debate or headline with.

Words are lower-cased and stemmed with the Snowball Swedish stemmer; the site runs the same
algorithm (frontend/src/politik/debatter/stem.ts). Swedish compounds put the head last
("grundskolan", "klimatpolitiken"), so a stem not in the lexicon is scored by the longest
lexicon stem it ends with, which is how "grundskol" finds "skol".

    python platform/nlp/issue_lexicon.py --evaluate     # train 2024/25, test 2025/26, report
    python platform/nlp/issue_lexicon.py                # train on every labelled session, write

Writes frontend/public/data/politics/parliament/issue-lexicon.json.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import snowballstemmer

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform/lib"))
import delivery  # noqa: E402

PUBLIC = ROOT / "frontend/public/data"
INDEX = "politics/parliament/debate-stats/index.json"
OUT = PUBLIC / "politics/parliament/issue-lexicon.json"

STEM = snowballstemmer.stemmer("swedish")
WORD = re.compile(r"[a-zåäöéü]+")

# Words that say how a debate is run, not what it is about, and party and office names, which
# would teach the lexicon who speaks rather than the subject.
STOP = set(
    """
    och att det som en på är för med av till den inte har de om vi jag ett men så var kan
    ska från eller också när här där detta dessa denna man mycket även bara då nu hur vad
    vilka vilket vilken sina sitt sin ni er ert era oss vår vårt våra mig dig sig honom henne
    dem deras hans hennes alla allt andra annan annat någon något några inga ingen inget
    skulle kunde måste vill vara varit blir blivit bli göra gör gjort gjorde får fått fick
    finns fanns sedan efter under över mellan utan genom mot vid hela helt redan fortfarande
    därför eftersom samtidigt dock både antingen ju väl nog kanske faktiskt verkligen tycker
    tror menar säger sagt talman talmannen herr fru replik repliken ledamot ledamoten
    ledamöter kammaren riksdagen riksdag debatt debatten anförande yrkar yrkande bifall
    reservation reservationen betänkandet betänkande utskottet utskottets motion motionen
    förslag förslaget propositionen proposition regeringen regeringens statsrådet ministern
    socialdemokraterna sverigedemokraterna moderaterna vänsterpartiet centerpartiet
    kristdemokraterna miljöpartiet liberalerna socialdemokrat sverigedemokrat moderat
    tack år åren dag dagen gång gången sätt fråga frågan frågor frågorna del delen
    sverige svenska svensk svenskt människor människ många fler flera stor stora viktigt
    viktig bra behöver behov just exempel exempelvis procent kronor miljarder miljoner
    """.split()
)
STOP_STEMS = {STEM.stemWord(w) for w in STOP}

KEEP = 500  # stems kept per area
MIN_COUNT = 6  # a stem must occur this often in the area to be kept
PRIOR = 0.01  # the Dirichlet prior's weight, relative to the background frequency


def stems(text: str) -> list[str]:
    out = []
    for word in WORD.findall(text.lower()):
        if len(word) < 3 or word in STOP:
            continue
        stem = STEM.stemWord(word)
        if len(stem) >= 3 and stem not in STOP_STEMS:
            out.append(stem)
    return out


def labelled_speeches(sessions: list[str]) -> list[tuple[str, str, str]]:
    """(session, area, text) for every speech in a debate with exactly one committee area."""
    index = json.loads((PUBLIC / INDEX).read_text(encoding="utf-8"))
    wanted = [s for s in index["sessions"] if s["session"] in sessions]
    debates = []
    for session in wanted:
        data = json.loads((PUBLIC / session["path"]).read_text(encoding="utf-8"))
        for d in data["debates"]:
            if d.get("issues_via") == "beslut" and len(d["issues"]) == 1:
                debates.append((session["session"], d))
    paths = sorted({d["path"] for _, d in debates})

    def load(path: str) -> tuple[str, list[dict]]:
        return path, json.loads(delivery.read_bytes(path))["data"]

    with ThreadPoolExecutor(delivery.workers()) as pool:
        shards = dict(pool.map(load, paths))
    rows = []
    for session, d in debates:
        for s in shards[d["path"]]:
            if d["first"] <= s["speech_number"] <= d["last"] and s.get("speech_text"):
                rows.append((session, d["issues"][0], s["speech_text"]))
    return rows


def learn(rows: list[tuple[str, str, str]]) -> dict[str, dict[str, float]]:
    """Per area, the stems with the highest z-scored log-odds against the other areas."""
    by_area: dict[str, Counter] = defaultdict(Counter)
    for _, area, text in rows:
        by_area[area].update(stems(text))
    total = Counter()
    for counts in by_area.values():
        total.update(counts)
    n_total = sum(total.values())
    alpha0 = PRIOR * n_total
    lexicon = {}
    for area, counts in by_area.items():
        n_i = sum(counts.values())
        n_j = n_total - n_i
        scored = []
        for stem, y_i in counts.items():
            if y_i < MIN_COUNT:
                continue
            a_w = alpha0 * total[stem] / n_total
            y_j = total[stem] - y_i
            delta = math.log((y_i + a_w) / (n_i + alpha0 - y_i - a_w)) - math.log(
                (y_j + a_w) / (n_j + alpha0 - y_j - a_w)
            )
            variance = 1 / (y_i + a_w) + 1 / (y_j + a_w)
            z = delta / math.sqrt(variance)
            if z > 2:
                scored.append((stem, z))
        scored.sort(key=lambda x: -x[1])
        lexicon[area] = {stem: round(min(z, 15.0), 2) for stem, z in scored[:KEEP]}
    return lexicon


def compound_index(lexicon: dict[str, dict[str, float]]) -> list[str]:
    """Lexicon stems long enough to be a compound's head, longest first."""
    heads = {s for weights in lexicon.values() for s in weights if len(s) >= 4}
    # Longest first, then alphabetical, so the site picks the same head (lexicon.ts).
    return sorted(heads, key=lambda h: (-len(h), h))


def score(text: str, lexicon: dict[str, dict[str, float]], heads: list[str]) -> dict[str, float]:
    """Area scores for a text: each stem's weight (or that of the compound head it ends with),
    times 1 + log of how often it occurs, so repetition counts but does not dominate."""
    counts = Counter(stems(text))
    totals: dict[str, float] = defaultdict(float)
    for stem, n in counts.items():
        hit = stem if any(stem in w for w in lexicon.values()) else None
        if hit is None and len(stem) >= 7:
            hit = next((h for h in heads if stem.endswith(h) and len(stem) - len(h) >= 3), None)
        if hit is None:
            continue
        factor = 1 + math.log(n)
        for area, weights in lexicon.items():
            if hit in weights:
                totals[area] += weights[hit] * factor
    return totals


def old_method(text: str, issues: list[dict]) -> str | None:
    """The hand-written keywords, as the site used them (data.ts issuesIn, one hit enough)."""
    words = re.findall(r"[a-zåäöéü-]+", text.lower())

    def matches(w: str, k: str) -> bool:
        return w == k or (w.startswith(k) and len(w) - len(k) <= 4 and len(k) >= 4)

    hits = [(i["key"], sum(1 for w in words if any(matches(w, k) for k in i["words"]))) for i in issues]
    hits = [h for h in hits if h[1] > 0]
    return max(hits, key=lambda h: h[1])[0] if hits else None


def evaluate(train: list, test: list, issues: list[dict]) -> dict:
    lexicon = learn(train)
    heads = compound_index(lexicon)
    report = {"speeches": len(test), "old": Counter(), "new": Counter()}
    per_area = defaultdict(lambda: {"n": 0, "old": 0, "new": 0})
    for _, area, text in test:
        old = old_method(text, issues)
        scores = score(text, lexicon, heads)
        new = max(scores, key=scores.get) if scores else None
        per_area[area]["n"] += 1
        for name, guess in (("old", old), ("new", new)):
            report[name]["labelled"] += guess is not None
            report[name]["correct"] += guess == area
            per_area[area][name] += guess == area
    return {
        "train_speeches": len(train),
        "test_speeches": len(test),
        "old_accuracy": report["old"]["correct"] / len(test),
        "new_accuracy": report["new"]["correct"] / len(test),
        "old_coverage": report["old"]["labelled"] / len(test),
        "new_coverage": report["new"]["labelled"] / len(test),
        "per_area": {
            a: {"speeches": v["n"], "old": round(v["old"] / v["n"], 3), "new": round(v["new"] / v["n"], 3)}
            for a, v in sorted(per_area.items())
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--train", nargs="+", default=["2024/25"])
    parser.add_argument("--test", nargs="+", default=["2025/26"])
    args = parser.parse_args()
    index = json.loads((PUBLIC / INDEX).read_text(encoding="utf-8"))
    issues = index["issues"]

    sessions = sorted(set(args.train + args.test))
    rows = labelled_speeches(sessions)
    train = [r for r in rows if r[0] in args.train]
    test = [r for r in rows if r[0] in args.test]
    result = evaluate(train, test, issues)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if args.evaluate:
        return 0

    # The published lexicon learns from every labelled session.
    lexicon = learn(rows)
    OUT.write_text(
        json.dumps(
            {
                "method": (
                    "Learned from the speeches in debates whose issue area is known from the "
                    "committee that prepared the decision: per area, the Snowball-stemmed words "
                    "that set it apart from the others (log-odds with an informative Dirichlet "
                    "prior, z-scores). A text is scored by its stems, each weighted 1 + log of its count; "
                    "a compound is scored by the lexicon stem it ends with."
                ),
                "trained_on": {"sessions": sessions, "speeches": len(rows)},
                "evaluation": result,
                # The site tokenises with the same stop words and minimum lengths.
                "stop": sorted(STOP),
                "stop_stems": sorted(STOP_STEMS),
                "min_length": 3,
                "areas": lexicon,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT.relative_to(ROOT)} ({sum(len(v) for v in lexicon.values())} stems).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
