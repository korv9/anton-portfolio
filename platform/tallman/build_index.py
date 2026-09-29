"""Build the search index Herr taLLMan answers from.

Two kinds of evidence, both from data already published by the site:

- datapoints: structured facts with their numbers (how often two parties voted alike, a
  party's budget against the government's, a survey result, seats). A claim built on one of
  these can be checked by recomputing it: Allegoria labels it "Beräknat".
- debates: one entry per Riksdag debate (title, date, parties speaking, frequent words), so a
  question can find the right debates; the speeches themselves are read from their shards at
  answer time (a shard holds a whole protocol, so each debate names its range of speech
  numbers), and a claim quoting them can be checked word for word.

Writes frontend/public/data/tallman/index.json. Standard library and pyarrow only.

    python platform/tallman/build_index.py
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
OUT = DATA / "tallman/index.json"

PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]
NAMES = {
    "S": "Socialdemokraterna", "SD": "Sverigedemokraterna", "M": "Moderaterna",
    "V": "Vänsterpartiet", "C": "Centerpartiet", "KD": "Kristdemokraterna",
    "MP": "Miljöpartiet", "L": "Liberalerna",
}
FIRST_SESSION = "2018/19"
DEBATE_SESSIONS = ("2022/23", "2023/24", "2024/25", "2025/26")

STOP = set("""
herr fru talman talmannen och att i det som en på är för av med till den har de inte om
ett vi jag så men kan ska var från eller också vara när vill detta här nu måste mer då
dem man hur alla sin sitt sina här där hade blir bli blivit ju just mycket många finns
utan efter under över även bara vad vilket vilka både genom mot inom helt redan dessutom
kommer skulle kunna får fick ta gör göra gjort sagt säger tror tycker menar vår våra vårt
er era ert oss du ni hon han honom henne deras dess denna dessa sådan sådana annat andra
""".split())

WORD = re.compile(r"[a-zåäöéü]+", re.I)


def pct(value: float, digits: int = 1) -> str:
    return f"{value:.{digits}f}".replace(".", ",")


def signed(value: int) -> str:
    sign = "+" if value > 0 else "−" if value < 0 else "±"
    return f"{sign}{abs(value):,}".replace(",", " ")


def load(path: str):
    obj = json.loads((DATA / path).read_text(encoding="utf-8-sig"))
    return obj


def datapoints() -> list[dict]:
    points: list[dict] = []
    sessions = load("parliament/sessions.json")
    for pair in sessions["party_pairs"]:
        a, b, session = pair["party_a"], pair["party_b"], pair["session"]
        if session < FIRST_SESSION or a not in PARTIES or b not in PARTIES:
            continue
        points.append({
            "id": f"rost:{session}:{a}-{b}",
            "kind": "agreement",
            "parties": [a, b],
            "session": session,
            "text": (f"{NAMES[a]} ({a}) och {NAMES[b]} ({b}) tog samma ståndpunkt i "
                     f"{pct(pair['agreement_pct'])} % av {pair['comparable_roll_calls']} jämförbara "
                     f"voteringar under riksmötet {session} ({pair['same_position']} gånger)."),
            "values": {"pct": pair["agreement_pct"], "n": pair["comparable_roll_calls"],
                       "same": pair["same_position"]},
            "terms": ["röstade", "lika", "samma", "ståndpunkt", "votering", "voteringar",
                      "omröstningar", "samarbete", "överens"],
            "href": f"#politik-roster?riksmote={session}&partier={a},{b}",
            "source": "Riksdagens voteringar, beräknat",
        })
    for record in sessions["party_record"]:
        p, session = record["party"], record["session"]
        if session < FIRST_SESSION or p not in PARTIES:
            continue
        parts = [f"{NAMES[p]} ({p}) deltog i {record['roll_calls']} voteringar under riksmötet {session}"]
        values = {"n": record["roll_calls"]}
        if record.get("with_government_pct") is not None:
            parts.append(f"röstade som regeringen i {pct(record['with_government_pct'])} % av dem")
            values["with_government_pct"] = record["with_government_pct"]
        parts.append(f"partiets enighet var {pct(record['cohesion_pct'])} %")
        parts.append(f"närvaron {pct(record['attendance_pct'])} %")
        values["cohesion_pct"] = record["cohesion_pct"]
        values["attendance_pct"] = record["attendance_pct"]
        points.append({
            "id": f"parti:{session}:{p}",
            "kind": "record",
            "parties": [p],
            "session": session,
            "text": ", ".join(parts) + ".",
            "values": values,
            "terms": ["regeringen", "enighet", "närvaro", "röstade", "voteringar", "sammanhållning"],
            "href": f"#politik-roster?riksmote={session}&matt=enighet&partier={p}",
            "source": "Riksdagens voteringar, beräknat",
        })

    report = load("gold/marts/budget-report.json")
    names = {}
    for row in report["budgets"]:
        names.setdefault(row["expenditure_area"], (row["budget_year"], row["expenditure_area_name"]))
        if row["budget_year"] > names[row["expenditure_area"]][0]:
            names[row["expenditure_area"]] = (row["budget_year"], row["expenditure_area_name"])
    years = sorted({row["budget_year"] for row in report["budgets"]})
    for doc in report["coverage"]["documents"]:
        year = 2000 + int(doc["session"][-2:])
        decision = (doc.get("frame_decision") or {}).get("winner")
        basis = ("regeringens förslag, som riksdagen beslutade" if decision == "utskottet"
                 else "regeringens förslag")
        for p, total in (doc.get("totals_msek") or {}).items():
            if p == "GOV" or p not in PARTIES:
                continue
            points.append({
                "id": f"budget:{year}:{p}",
                "kind": "budget_total",
                "parties": [p],
                "session": doc["session"],
                "year": year,
                "text": (f"{NAMES[p]}s ({p}) budgetmotion för {year} innebar sammanlagt {signed(total)} mnkr "
                         f"jämfört med {basis} (finansutskottets summa över alla utgiftsområden)."),
                "values": {"msek": total},
                "terms": ["budget", "budgeten", "pengar", "mnkr", "kronor", "satsa", "satsar", "lägga"],
                "href": f"#politik-budget?ar={year}&partier={p}",
                "source": doc["source_url"],
            })
    for row in report["budgets"]:
        if row["actor"] not in PARTIES or row["budget_year"] < years[-3] or row["deviation_msek"] == 0:
            continue
        area = names[row["expenditure_area"]][1]
        p, year = row["actor"], row["budget_year"]
        points.append({
            "id": f"budget:{year}:{p}:{row['expenditure_area']}",
            "kind": "budget_area",
            "parties": [p],
            "session": row["session"],
            "year": year,
            "text": (f"{NAMES[p]} ({p}) föreslog {signed(row['deviation_msek'])} mnkr för utgiftsområde "
                     f"{row['expenditure_area']} {area} {year}, jämfört med regeringens förslag på "
                     f"{row['government_amount_msek']:,} mnkr.".replace(",", " ").replace("  ", ", ")),
            "values": {"msek": row["deviation_msek"], "gov_msek": row["government_amount_msek"]},
            "terms": ["budget", "pengar", "mnkr", "satsa", *WORD.findall(area.lower())],
            "href": f"#politik-budget?ar={year}&partier={p}",
            "source": row["source_url"],
        })

    polls = load("parliament/polls.json")["polls"]
    months = sorted({p["survey_month"] for p in polls})[-4:]
    for poll in polls:
        if poll["survey_month"] not in months or poll["party"] not in PARTIES:
            continue
        p, month = poll["party"], poll["survey_month"][:7]
        margin = poll.get("margin_of_error_pp")
        points.append({
            "id": f"psu:{month}:{p}",
            "kind": "poll",
            "parties": [p],
            "month": month,
            "text": (f"{NAMES[p]} ({p}) fick {pct(poll['share_pct'])} % i SCB:s partisympatiundersökning "
                     f"{month}" + (f" (felmarginal ±{pct(margin)} procentenheter)." if margin else ".")),
            "values": {"pct": poll["share_pct"], **({"margin": margin} if margin else {})},
            "terms": ["opinion", "opinionen", "mätning", "mätningen", "stöd", "väljarna", "psu", "scb"],
            "href": f"#politik-valjarna?partier={p}",
            "source": "SCB, Partisympatiundersökningen",
        })

    now = load("parliament/now.json")
    election = now["election"]
    for result in election["parties"]:
        p = result["party"]
        if p not in PARTIES:
            continue
        points.append({
            "id": f"val:{election['year']}:{p}",
            "kind": "election",
            "parties": [p],
            "year": election["year"],
            "text": (f"{NAMES[p]} ({p}) fick {result['seats']} mandat och {pct(result['share_pct'])} % "
                     f"av rösterna i riksdagsvalet {election['year']}."),
            "values": {"seats": result["seats"], "pct": result["share_pct"]},
            "terms": ["val", "valet", "mandat", "röster", "rösterna", "riksdagsvalet"],
            "href": "#now-seats",
            "source": election["source"],
        })
    return points


def debates() -> list[dict]:
    by_path: dict[str, dict] = {}
    words: dict[str, Counter] = defaultdict(Counter)
    for session in DEBATE_SESSIONS:
        folder = DATA / f"parquet/speech_cards/session={session.replace('/', '-')}"
        for part in sorted(folder.glob("*.parquet")):
            for row in pq.read_table(part).to_pylist():
                # A shard holds a whole protocol; each debate in it is a range of speech numbers.
                path = "politics/parliament/" + row["path"]
                protocol = row["path"].rsplit("/", 1)[-1].removesuffix(".json")
                key = f"{protocol}-{row['first']}"
                entry = by_path.setdefault(key, {
                    "id": key,
                    "path": path,
                    "first": row["first"],
                    "last": row["last"],
                    "title": row["title"],
                    "session": row["session"],
                    "date": row["speech_date"],
                    "kind": row["kind"],
                    "parties": Counter(),
                    "speeches": 0,
                })
                entry["speeches"] += 1
                entry["date"] = min(entry["date"], row["speech_date"])
                if row["party"] in PARTIES:
                    entry["parties"][row["party"]] += 1
                words[key].update(w for w in WORD.findall((row["excerpt"] or "").lower())
                                   if len(w) > 3 and w not in STOP)
    out = []
    for key, entry in by_path.items():
        entry["parties"] = dict(entry["parties"])
        entry["words"] = [w for w, _ in words[key].most_common(30)]
        out.append(entry)
    return sorted(out, key=lambda d: d["date"], reverse=True)


def main() -> None:
    points = datapoints()
    deb = debates()
    index = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": ("Datapoints are recomputable facts from the site's published data; debates point to "
                 "speech shards read at answer time."),
        "counts": {"datapoints": len(points), "debates": len(deb)},
        "datapoints": points,
        "debates": deb,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(points)} datapoints, {len(deb)} debates, {OUT.stat().st_size / 1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
