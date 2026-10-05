"""Party profiles for the politics product's Partier page.

Two sources the rest of the site does not have yet, fetched and cached under
platform/.cache/parties/ (gitignored):

- Riksdagen, the list of people (data.riksdagen.se/personlista): who sits in the Riksdag for
  each party now, with constituency, gender, birth year and photo; current committee posts,
  party posts (leader, spokesperson, group leader, secretary) and ministers.
- Valmyndigheten, the municipal council election (resultat.val.se): seats per party in every
  municipality's council (kommunfullmäktige), with the seats after the election before. The
  latest election's count may still be preliminary; each municipality says which it is.

Writes frontend/public/data/politics/parties/index.json (a summary per party for the cards)
and one file per party with its members and councils.

    python platform/publish/export_party_profiles.py            # use the cache
    python platform/publish/export_party_profiles.py --refresh  # fetch again
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "platform/.cache/parties"
OUT = ROOT / "frontend/public/data/politics/parties"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]
PEOPLE = "https://data.riksdagen.se/personlista/?utformat=json&rdlstatus=tjanst"
VAL = "https://resultat.val.se/data"
ELECTION = "val2026"
PARTY_POSTS = {"Partiledare", "Språkrör", "Gruppledare", "Partisekreterare"}
REFRESH = "--refresh" in sys.argv
TODAY = date.today().isoformat()


def fetch(url: str, name: str):
    path = CACHE / name
    if path.exists() and not REFRESH:
        return json.loads(path.read_text(encoding="utf-8"))
    request = urllib.request.Request(url, headers={"User-Agent": "anton-portfolio data build"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read()
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return json.loads(body)


def current(assignment: dict) -> bool:
    start = (assignment.get("from") or "")[:10]
    end = (assignment.get("tom") or "9999")[:10]
    return start <= TODAY <= end


def members() -> dict[str, list[dict]]:
    people = fetch(PEOPLE, "personlista.json")["personlista"]["person"]
    out: dict[str, list[dict]] = {p: [] for p in PARTIES}
    for person in people:
        party = person.get("parti")
        assignments = (person.get("personuppdrag") or {}).get("uppdrag") or []
        if isinstance(assignments, dict):
            assignments = [assignments]
        # Elected members hold the seats; those on leave (ministers, most often) count too, their
        # substitutes do not, so the count per party equals its seats.
        seat = [a for a in assignments if a.get("typ") == "kammaruppdrag" and current(a)
                and a.get("roll_kod") == "Riksdagsledamot"]
        if party not in PARTIES or not seat:
            continue
        posts = [a for a in assignments if current(a)]
        out[party].append({
            "name": f"{person['tilltalsnamn']} {person['efternamn']}",
            "constituency": person.get("valkrets") or "",
            "gender": person.get("kon") or "",
            "born": int(person["fodd_ar"]) if (person.get("fodd_ar") or "").isdigit() else None,
            "photo": person.get("bild_url_80") or "",
            "status": person.get("status") or "",
            "on_leave": seat[0].get("status") == "Ledig",
            "committees": sorted({
                f"{a['roll_kod']}|{a['organ_kod']}|{(a.get('uppgift') or [''])[0]}"
                for a in posts if a.get("typ") == "uppdrag"
                and a.get("roll_kod") in ("Ledamot", "Ordförande", "Vice ordförande")
                and str(a.get("organ_kod", "")).endswith("U")
            }),
            "party_posts": sorted({a["roll_kod"] for a in posts
                                   if a.get("typ") == "partiuppdrag"
                                   and a.get("roll_kod") in PARTY_POSTS}),
            "minister": next((a["roll_kod"] for a in posts if a.get("typ") == "Departement"), None),
            "url": f"https://www.riksdagen.se/sv/ledamoter-och-partier/ledamot/_{person['intressent_id']}/",
        })
    for party in out:
        out[party].sort(key=lambda m: (m["constituency"], m["name"]))
    return out


def councils() -> tuple[dict[str, list[dict]], dict]:
    geography = fetch(f"{VAL}/valgeografi/valgeografi_{ELECTION}.json", f"{ELECTION}/valgeografi.json")
    kf = next(t for t in geography["valgeografi"] if t["kod"] == "KF")
    out: dict[str, list[dict]] = {p: [] for p in PARTIES}
    counted = Counter()
    municipalities = 0
    for county in kf["valgeografi"]:
        for municipality in county["valgeografi"] or []:
            code = municipality["kod"]
            result = None
            for count in ("S", "P"):  # the final count first, else the preliminary one
                try:
                    candidate = fetch(f"{VAL}/resultat/{ELECTION}/KF_{county['kod']}_{code}_{count}.json",
                                      f"{ELECTION}/KF_{code}_{count}.json")
                except Exception:
                    continue
                if candidate.get("partiMandat"):
                    result = candidate
                    break
            if not result or not result.get("partiMandat"):
                continue
            municipalities += 1
            counted[result.get("rakningstillfalle", "")] += 1
            seats = {p["partiforkortning"]: p for p in result["partiMandat"]}
            total = sum(p["antalMandat"] for p in result["partiMandat"])
            top = max(result["partiMandat"], key=lambda p: p["antalMandat"])
            for party in PARTIES:
                row = seats.get(party)
                out[party].append({
                    "code": code,
                    "name": municipality["namn"],
                    "county": county["namn"],
                    "seats": row["antalMandat"] if row else 0,
                    "seats_before": row["antalMandatForegaendeVal"] if row else 0,
                    "total": total,
                    "largest": bool(row) and row["antalMandat"] == top["antalMandat"] and row["antalMandat"] > 0,
                })
            time.sleep(0.02 if not REFRESH else 0.1)
    meta = {"election": ELECTION[3:], "municipalities": municipalities, "counts": dict(counted)}
    return out, meta


def main() -> None:
    people = members()
    council, council_meta = councils()
    OUT.mkdir(parents=True, exist_ok=True)
    summary = {}
    for party in PARTIES:
        rows = council[party]
        mps = people[party]
        committees = Counter(c.split("|")[2] or c.split("|")[1] for m in mps for c in m["committees"])
        summary[party] = {
            "members": len(mps),
            "on_leave": sum(1 for m in mps if m["on_leave"]),
            "women": sum(1 for m in mps if m["gender"] == "kvinna"),
            "leaders": [{"name": m["name"], "post": p} for m in mps for p in m["party_posts"]
                        if p in ("Partiledare", "Språkrör")],
            "ministers": [{"name": m["name"], "post": m["minister"]} for m in mps if m["minister"]],
            "council_seats": sum(r["seats"] for r in rows),
            "council_seats_before": sum(r["seats_before"] for r in rows),
            "council_municipalities": sum(1 for r in rows if r["seats"] > 0),
            "council_largest": sum(1 for r in rows if r["largest"]),
        }
        (OUT / f"{party.lower()}.json").write_text(json.dumps({
            "party": party,
            "members": mps,
            "committees": dict(committees.most_common()),
            "councils": rows,
        }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": {
            "members": {"url": PEOPLE, "as_of": TODAY,
                        "note": "Elected members with a current seat, those on leave (e.g. ministers) included, substitutes not."},
            "councils": {"url": f"https://resultat.val.se/{ELECTION}/slutligt/KF", **council_meta,
                         "note": "Seats in each municipal council; seats_before is the election before."},
        },
        "parties": summary,
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    seats = sum(s["members"] for s in summary.values())
    print(f"{seats} members, {council_meta['municipalities']} municipalities {council_meta['counts']} -> {OUT}")


if __name__ == "__main__":
    main()
