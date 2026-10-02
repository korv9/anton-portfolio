"""Precompute what the politics story page needs from text and member votes, so the browser gets
compact JSON instead of hundreds of shards.

Four parts, each descriptive, none a judgement:

- members: for every member, the votes registered in the analysed sessions (yes, no, abstain,
  absent) and how many of the cast votes differed from the party's position in that roll call.
  Absence and deviation are counts, not opposition; the page says so.
- leader_debates: per party-leader debate and party, speeches, replies and words, the issue
  areas the words point to (the learned lexicon, the same as the site), and the party's most
  distinctive word stems in that debate (tf-idf against all party-leader debates).
- agenda: per riksmöte, the share of the issue debates' speeches and replies in each issue area.
- terms: word stems in the issue debates that grew or fell most, per 10,000 words, between the
  latest riksmöte and the three before it.

Reads the decision details, debate shards and lexicon through the delivery (R2 or local), and
writes frontend/public/data/politics/parliament/story.json.

    python platform/publish/politics_story.py
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform/lib"))
sys.path.insert(0, str(ROOT / "platform/nlp"))
import delivery  # noqa: E402
from issue_lexicon import compound_index, score, stems  # noqa: E402

PUBLIC = ROOT / "frontend/public/data"
OUT = PUBLIC / "politics/parliament/story.json"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]
CAST = {"Ja", "Nej", "Avstår"}
# Field codes from word processors that survive in some older protocols' text.
ARTIFACTS = {"mergeformat", "styleref", "kantrubrik", "charformat", "pageref", "hyperlink"}


# ---------------------------------------------------------------- pure helpers (tested)


def per_10k(count: int, words: int) -> float:
    """A count per 10,000 words, so periods and parties of different length compare."""
    return 10_000 * count / words if words else 0.0


def member_stats(decisions: list[dict]) -> tuple[list[dict], dict]:
    """Per member: registered votes and how many cast votes differed from the party position.

    `decisions` are decision details: {"parties": [{party, party_position}], "members":
    [{member_id, member_name, party, vote}]}. A member counted twice in one roll call is counted
    once (and reported); a member seen in more than one party keeps every party, in order.
    """
    out: dict[str, dict] = {}
    quality = Counter()
    for d in decisions:
        position = {p["party"]: p.get("party_position") for p in d.get("parties", [])}
        seen = set()
        for m in d.get("members", []):
            key = m.get("member_id") or m.get("member_name")
            if not key:
                quality["member_without_id"] += 1
                continue
            if key in seen:
                quality["duplicate_member_vote"] += 1
                continue
            seen.add(key)
            row = out.setdefault(
                key,
                {"id": key, "name": m.get("member_name", ""), "parties": [], "yes": 0, "no": 0,
                 "abstain": 0, "absent": 0, "compared": 0, "deviating": 0},
            )
            party = m.get("party") or ""
            if party and party not in row["parties"]:
                row["parties"].append(party)
            vote = m.get("vote")
            row[{"Ja": "yes", "Nej": "no", "Avstår": "abstain"}.get(vote, "absent")] += 1
            pos = position.get(party)
            if vote in CAST and pos in CAST:
                row["compared"] += 1
                row["deviating"] += vote != pos
    quality["members_in_more_than_one_party"] = sum(len(r["parties"]) > 1 for r in out.values())
    return list(out.values()), dict(quality)


def tfidf_terms(
    docs: dict[str, Counter], df: Counter, n_docs: int, top: int = 8, min_count: int = 3,
    exclude: set[str] = frozenset(),
):
    """Per document, the stems with the highest tf-idf (tf per 10,000 words, idf over all docs).
    `exclude` drops stems that are not terms, such as people's names."""
    out = {}
    for key, counts in docs.items():
        words = sum(counts.values())
        scored = [
            (stem, per_10k(c, words) * math.log(n_docs / df[stem]))
            for stem, c in counts.items()
            if c >= min_count and df[stem] < n_docs and stem not in exclude
        ]
        scored.sort(key=lambda x: (-x[1], x[0]))
        out[key] = [{"stem": s, "per_10k": round(per_10k(counts[s], words), 1), "score": round(v, 1)}
                    for s, v in scored[:top]]
    return out


def rising_terms(
    now: Counter, before: Counter, min_count: int = 40, top: int = 15, allowed: set[str] | None = None
):
    """Stems that grew and fell most per 10,000 words between two periods (smoothed ratio).
    `allowed`, when given, keeps only those stems (used to drop names and rare stems)."""
    wn, wb = sum(now.values()), sum(before.values())
    rows = []
    for stem in set(now) | set(before):
        if allowed is not None and stem not in allowed:
            continue
        a, b = now[stem], before[stem]
        if a + b < min_count:
            continue
        ra, rb = per_10k(a, wn), per_10k(b, wb)
        ratio = (ra + 0.5) / (rb + 0.5)
        rows.append({"stem": stem, "now": round(ra, 2), "before": round(rb, 2), "ratio": round(ratio, 2)})
    rows.sort(key=lambda r: (-r["ratio"], r["stem"]))
    rising = rows[:top]
    falling = sorted(rows, key=lambda r: (r["ratio"], r["stem"]))[:top]
    return {"rising": rising, "falling": falling, "words_now": wn, "words_before": wb}


def surface_forms(texts: list[str]) -> dict[str, str]:
    """The most common word behind each stem, to show readers a word, not a stem."""
    import re

    from issue_lexicon import STEM, WORD

    forms: dict[str, Counter] = defaultdict(Counter)
    for t in texts:
        for w in WORD.findall(t.lower()):
            if len(w) >= 3:
                forms[STEM.stemWord(w)][w] += 1
    del re
    return {s: c.most_common(1)[0][0] for s, c in forms.items()}


# ---------------------------------------------------------------- loading


def read(path: str):
    return json.loads(delivery.read_bytes(path))


def parallel(paths):
    with ThreadPoolExecutor(delivery.workers()) as pool:
        return dict(zip(paths, pool.map(read, paths)))


def main() -> int:
    lexicon_file = json.loads((PUBLIC / "politics/parliament/issue-lexicon.json").read_text(encoding="utf-8"))
    lexicon = lexicon_file["areas"]
    heads = compound_index(lexicon)
    debate_index = json.loads((PUBLIC / "politics/parliament/debate-stats/index.json").read_text(encoding="utf-8"))

    # Members: every decision point in the sessions with decision details.
    sessions = sorted(p.name for p in (PUBLIC / "politics/decisions").iterdir() if p.is_dir())
    decisions = []
    for s in sessions:
        index = json.loads((PUBLIC / f"politics/decisions/{s}/index.json").read_text(encoding="utf-8"))
        details = parallel(["politics/" + d["path"] for d in index])
        decisions += details.values()
    members, quality = member_stats(decisions)
    constituency = {}
    for p in PARTIES:
        prof = json.loads((PUBLIC / f"politics/parties/{p.lower()}.json").read_text(encoding="utf-8"))
        for m in prof["members"]:
            constituency[m["name"]] = m.get("constituency")
    for m in members:
        m["constituency"] = constituency.get(m["name"])
    print(f"members: {len(members)} from {len(decisions)} decision points", quality)

    # Names are not terms: every word of every member's and speaker's name is left out of the
    # keywords and term lists (stemmed, as the words are).
    from issue_lexicon import STEM, WORD

    name_words = {w for m in members for w in WORD.findall(m["name"].lower())}

    # Party-leader debates.
    leaders = debate_index["leaders"]
    shards = parallel([d["path"] for d in leaders])
    for sh in shards.values():
        for r in sh["data"]:
            name_words |= set(WORD.findall(str(r.get("speaker", "")).lower()))
    names = {STEM.stemWord(w) for w in name_words if len(w) >= 3}
    docs: dict[str, Counter] = {}
    texts_for_forms: list[str] = []
    per_debate = []
    for d in leaders:
        rows = shards[d["path"]]["data"]
        parties = {}
        party_text: dict[str, list[str]] = defaultdict(list)
        for r in rows:
            p = r.get("party")
            if p not in PARTIES or not r.get("speech_text"):
                continue
            row = parties.setdefault(p, {"speeches": 0, "replies": 0, "words": 0, "speakers": []})
            row["replies" if str(r.get("is_reply")) == "True" else "speeches"] += 1
            row["words"] += int(r.get("word_count") or 0)
            if r["speaker"] not in row["speakers"]:
                row["speakers"].append(r["speaker"])
            party_text[p].append(r["speech_text"])
        all_text = " ".join(t for ts in party_text.values() for t in ts)
        texts_for_forms.append(all_text)

        def shares(text: str):
            sc = score(text, lexicon, heads)
            total = sum(sc.values())
            return {k: round(v / total * 100, 1) for k, v in sorted(sc.items(), key=lambda x: -x[1])} if total else {}

        for p, ts in party_text.items():
            docs[f"{d['id']}|{p}"] = Counter(stems(" ".join(ts)))
            parties[p]["topics"] = shares(" ".join(ts))
        per_debate.append({"id": d["id"], "date": d["date"], "session": d["session"],
                           "parties": parties, "topics": shares(all_text)})
    df = Counter()
    for c in docs.values():
        df.update(set(c))
    keywords = tfidf_terms(docs, df, len(docs), exclude=names)
    forms = surface_forms(texts_for_forms)
    for d in per_debate:
        for p, row in d["parties"].items():
            row["keywords"] = [{**k, "word": forms.get(k["stem"], k["stem"])} for k in keywords.get(f"{d['id']}|{p}", [])]
    print(f"leader debates: {len(per_debate)}")

    # Agenda: the issue debates' speeches and replies per issue area, per riksmöte.
    agenda = []
    for s in debate_index["sessions"]:
        data = json.loads((PUBLIC / s["path"]).read_text(encoding="utf-8"))
        weight = Counter()
        for deb in data["debates"]:
            n = deb["speeches"]
            for issue in deb["issues"]:
                weight[issue] += n / len(deb["issues"])
        total = sum(weight.values())
        agenda.append({"session": s["session"],
                       "shares": {k: round(v / total * 100, 2) for k, v in weight.most_common()} if total else {}})

    # Terms: the latest riksmöte against the three before, in the issue debates' speeches.
    recent = [s for s in debate_index["sessions"]][-4:]
    period_counts = {"now": Counter(), "before": Counter()}
    speech_df = Counter()  # in how many speeches a stem occurs, both periods
    sample_texts = []
    for i, s in enumerate(recent):
        data = json.loads((PUBLIC / s["path"]).read_text(encoding="utf-8"))
        paths = sorted({deb["path"] for deb in data["debates"]})
        sh = parallel(paths)
        key = "now" if i == len(recent) - 1 else "before"
        for deb in data["debates"]:
            for r in sh[deb["path"]]["data"]:
                if deb["first"] <= int(r["speech_number"]) <= deb["last"] and r.get("speech_text"):
                    st = stems(r["speech_text"])
                    period_counts[key].update(st)
                    speech_df.update(set(st))
                    if len(sample_texts) < 40000:
                        sample_texts.append(r["speech_text"])
    # A term must occur in at least 25 different speeches and not be a name; this also drops
    # leftovers of word-processor formatting in older protocols.
    for st in {STEM.stemWord(w) for w in ARTIFACTS}:
        speech_df.pop(st, None)
    allowed = {st for st, n in speech_df.items() if n >= 25 and st not in names}
    terms = rising_terms(period_counts["now"], period_counts["before"], allowed=allowed)
    term_forms = surface_forms(sample_texts)
    for side in ("rising", "falling"):
        for r in terms[side]:
            r["word"] = term_forms.get(r["stem"], r["stem"])
    terms["now"] = recent[-1]["session"]
    terms["before"] = [s["session"] for s in recent[:-1]]
    print(f"terms: {terms['words_now']:,} words now, {terms['words_before']:,} before")

    OUT.write_text(
        json.dumps(
            {
                "method": {
                    "members": "Registered votes per member in the analysed sessions. Deviating: a cast vote (yes, no, abstain) that differs from the party's position in that roll call, of the cast votes where the party had one. Absence and deviation are not opposition by themselves.",
                    "leader_debates": "Words, speeches and replies per party and debate. Topics: the learned issue lexicon applied to the party's speeches. Keywords: word stems with the highest tf-idf, term frequency per 10,000 words times log(documents / documents with the stem), where a document is one party in one party-leader debate.",
                    "agenda": "Per riksmöte, each issue debate's speeches and replies shared equally across its issue areas, as a share of all.",
                    "terms": "Word stems in the issue debates per 10,000 words, the latest riksmöte against the three before; ratio smoothed by +0.5 per 10,000 words; only stems used at least 40 times.",
                },
                "sessions": sessions,
                "quality": {**quality, "decision_points": len(decisions)},
                "members": sorted(members, key=lambda m: m["name"]),
                "leader_debates": per_debate,
                "agenda": agenda,
                "terms": terms,
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
