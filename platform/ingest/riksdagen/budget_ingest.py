"""Hämta utgiftsramar ur finansutskottets årliga budgetbetänkande FiU1."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

import duckdb
import pandas as pd

API = "https://data.riksdagen.se/dokumentlista/"
PARTIES = {"S", "M", "V", "MP", "C", "L", "FP", "KD", "KDS", "SD", "NYD"}


def download(url: str) -> bytes:
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "partiledardebatt-analys/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except (OSError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2**attempt)


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in {"td", "th"} and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in {"td", "th"} and self.cell is not None and self.row is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if any(self.row):
                self.rows.append(self.row)
            self.row = None


def number(value: str) -> int | None:
    value = value.replace("−", "-").replace("–", "-").replace("±", "")
    value = re.sub(r"[\s\u00a0]", "", value)
    if not value or value in {"..", ".", "-"}:
        return None
    match = re.search(r"[-+]?\d+", value)
    return int(match.group()) if match else None


AREA = re.compile(r"\d{1,2}")
# Rounding each of 27 areas to whole millions moves a sum by at most 13.5.
ROUNDING_TOLERANCE_MSEK = 13


def _figures(cells: list[str], expected: int) -> list[str]:
    """The figures of one table row, repaired where the HTML export split them: an empty
    extra cell, or a number broken over two cells ("+4", "769" for +4 769). Only applied when
    the row has more cells than columns, so a row that reads cleanly is left as it is."""
    values = list(cells)
    if len(values) > expected:
        values = [value for value in values if value != ""]
    while len(values) > expected:
        for i in range(len(values) - 1):
            if (re.fullmatch(r"[+−–-]?\d{1,3}", values[i])
                    and re.fullmatch(r"\d{3}", values[i + 1])):
                values[i:i + 2] = [f"{values[i]} {values[i + 1]}"]
                break
        else:
            break
    return values[:expected]


def _table_at(html: str, position: int) -> tuple[list[list[str]], int, int] | None:
    start_match = re.search(r"<table\b", html[position:], flags=re.I)
    if not start_match:
        return None
    start = position + start_match.start()
    end_match = re.search(r"</table\s*>", html[start:], flags=re.I)
    if not end_match:
        return None
    parser = TableParser()
    parser.feed(html[start:start + end_match.end()])
    return parser.rows, start, start + end_match.end()


def _is_total(row: list[str]) -> bool:
    label = next((cell for cell in row if cell), "").casefold()
    return label.startswith(("summa utgiftsområden", "summa utgifter"))


def budget_table(html: str, budget_year: int | None = None) -> tuple[list[str], list[list[str]], list[str] | None]:
    """The committee's comparison of the government's and the parties' expenditure frames:
    the party columns, one row per expenditure area and the total row as printed.

    The report also tabulates the two years after the budget year, so only the table for the
    budget year is read (its last mention; the first is the contents list). A table that runs
    over a page break continues in the next HTML table, sometimes shifted one column; the rows
    are joined until all areas are read or the table's source note is reached."""
    year = str(budget_year) if budget_year else r"20\d{2}"
    titles = list(re.finditer(
        rf"Regeringens och (?:motionärernas|oppositionspartiernas) förslag till utgiftsramar(?:\s+för)?\s+{year}\b",
        html,
        flags=re.I,
    ))
    if not titles:
        raise ValueError("Hittade ingen jämförelsetabell för utgiftsramar")
    first = _table_at(html, titles[-1].end())
    if first is None:
        raise ValueError("Jämförelsetabellen saknar komplett HTML-tabell")
    rows, _, end = first
    header_index = next(
        (i for i, row in enumerate(rows) if any(cell.upper() in PARTIES for cell in row)),
        None,
    )
    if header_index is None:
        raise ValueError("Kunde inte identifiera partikolumner")
    parties = [cell.upper().replace("FP", "L").replace("KDS", "KD")
               for cell in rows[header_index] if cell.upper() in PARTIES]
    width = 3 + len(parties)
    data: list[list[str]] = []
    total: list[str] | None = None

    def take(table_rows: list[list[str]]) -> None:
        nonlocal total
        for row in table_rows:
            # A continuation table may start one column to the right.
            if len(row) > 1 and not row[0] and AREA.fullmatch(row[1]):
                row = row[1:]
            if AREA.fullmatch(row[0]) and len(row) >= 3:
                if all(existing[0] != row[0] for existing in data):
                    data.append(row[:2] + _figures(row[2:], width - 2))
            elif (data and len(row) > 1 and not row[0] and row[1]
                  and not any(row[2:]) and not AREA.fullmatch(row[1])):
                # The rest of an area name that wrapped onto the next line.
                data[-1][1] = f"{data[-1][1]} {row[1]}"
            elif _is_total(row) and total is None:
                label = next(i for i, cell in enumerate(row) if cell)
                total = [row[label], *_figures(row[label + 1:], width - 2)]

    take(rows[header_index + 1:])
    position = end
    for _ in range(2):
        if len(data) >= 27 or total is not None:
            break
        following = _table_at(html, position)
        if following is None:
            break
        between = re.sub(r"<[^>]+>", " ", html[position:following[1]])
        if re.search(r"Källor?:|Tabell\s+\d", between):
            break
        take(following[0])
        position = following[2]
    if len(data) < 20:
        raise ValueError(f"Bara {len(data)} utgiftsområden kunde läsas")
    return parties, data, total


def budget_totals(html: str, session: str) -> dict[str, int]:
    """The committee's own sum over all expenditure areas: the government's total and each
    party's net difference from it. Summing the rounded area figures can be off by a few
    million kronor, so the published total is kept as printed."""
    parties, _, total = budget_table(html, int("20" + session.split("/")[1]))
    if total is None:
        return {}
    values = [value for value in (number(cell) for cell in total[1:]) if value is not None]
    if len(values) < 1 + len(parties):
        return {}
    return {"GOV": values[0], **dict(zip(parties, values[1:1 + len(parties)]))}


def parse_document(html: str, session: str, document_id: str, source_url: str) -> list[dict]:
    budget_year = int("20" + session.split("/")[1])
    parties, rows, total = budget_table(html, budget_year)
    if len(rows) != 27:
        raise ValueError(f"{len(rows)} av 27 utgiftsområden kunde läsas")
    if total is not None:
        # Every column must add up to the committee's own total, or a figure was misread.
        printed = [number(cell) for cell in total[1:]]
        for column, (label, expected) in enumerate(zip(["GOV", *parties], printed)):
            if expected is None:
                continue
            read = sum(number(row[2 + column]) or 0 for row in rows)
            if abs(read - expected) > ROUNDING_TOLERANCE_MSEK:
                raise ValueError(f"{label}: områdena summerar till {read}, tabellen säger {expected}")
    output = []
    for row in rows:
        area = int(row[0])
        government = number(row[2])
        if government is None:
            continue
        common = {
            "session": session,
            "budget_year": budget_year,
            "expenditure_area": area,
            "expenditure_area_name": row[1],
            "government_amount_msek": government,
            "document_id": document_id,
            "source_url": source_url,
        }
        output.append({**common, "actor": "GOV", "proposal_type": "government",
                       "deviation_msek": 0, "amount_msek": government})
        for party, raw in zip(parties, row[3:3 + len(parties)]):
            deviation = number(raw)
            if deviation is not None:
                output.append({**common, "actor": party, "proposal_type": "party_motion",
                               "deviation_msek": deviation, "amount_msek": government + deviation})
    return output


def discover(session: str | None) -> list[dict]:
    query = {"doktyp": "bet", "org": "FiU", "bet": "FiU1", "sz": 100,
             "sort": "datum", "sortorder": "desc", "utformat": "json"}
    if session:
        query["rm"] = session
    payload = json.loads(download(API + "?" + urllib.parse.urlencode(query)).decode("utf-8"))
    documents = payload["dokumentlista"]["dokument"]
    if isinstance(documents, dict):
        documents = [documents]
    return [doc for doc in documents if doc.get("beteckning", "").casefold() == "fiu1"
            and (not session or doc.get("rm") == session)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session", help="Begränsa till exempelvis 2025/26")
    parser.add_argument("--from-session", default="2014/15", help="Äldsta riksmöte utan --session")
    parser.add_argument("--to-session", help="Senaste riksmöte utan --session")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--data-dir", default=str(Path(__file__).resolve().parents[3] / 'warehouse'))
    args = parser.parse_args()
    root = Path(args.data_dir)
    raw = root / "raw" / "budgets"
    raw.mkdir(parents=True, exist_ok=True)
    frames, documents, errors = [], [], []
    grouped: dict[str, list[dict]] = {}
    for doc in discover(args.session):
        session = doc["rm"]
        if not args.session and session < args.from_session:
            continue
        if not args.session and args.to_session and session > args.to_session:
            continue
        grouped.setdefault(session, []).append(doc)
    for session, candidates in grouped.items():
        candidate_errors = []
        for doc in sorted(candidates, key=lambda item: (item["dok_id"].casefold().endswith("d2"), item["dok_id"])):
            document_id = doc["dok_id"]
            url = doc.get("dokument_url_html") or f"https://data.riksdagen.se/dokument/{document_id}"
            if url.startswith("//"):
                url = "https:" + url
            path = raw / f"{session.replace('/', '-')}_{document_id}.html"
            try:
                if args.refresh or not path.exists():
                    path.write_bytes(download(url))
                rows = parse_document(path.read_text(encoding="utf-8-sig"), session, document_id, url)
                frames.extend(rows)
                documents.append({"session": session, "document_id": document_id, "source_url": url,
                                  "rows": len(rows),
                                  "totals_msek": budget_totals(path.read_text(encoding="utf-8-sig"), session)})
                print(f"{session} {document_id}: {len(rows)} budgetrader", flush=True)
                break
            except Exception as exc:
                candidate_errors.append({"document_id": document_id, "error": str(exc)})
        else:
            errors.append({"session": session, "candidates": candidate_errors})
            print(f"SAKNAS {session}: ingen maskinläsbar jämförelsetabell", flush=True)
    if not frames:
        raise SystemExit("Inga budgetramar kunde importeras")
    columns = list(frames[0])
    csv_path = root / "budget_frames.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(frames)
    sqlite_path = root / "budgets.sqlite"
    with sqlite3.connect(sqlite_path) as db:
        db.execute("drop table if exists budget_frames")
        db.execute("create table budget_frames (session text, budget_year integer, expenditure_area integer, "
                   "expenditure_area_name text, government_amount_msek integer, document_id text, "
                   "source_url text, actor text, proposal_type text, deviation_msek integer, amount_msek integer, "
                   "primary key(session, expenditure_area, actor))")
        db.executemany("insert into budget_frames values (?,?,?,?,?,?,?,?,?,?,?)",
                       [[row[col] for col in columns] for row in frames])
    analytics = root / "analytics.duckdb"
    if analytics.exists():
        frame = pd.DataFrame(frames)
        with duckdb.connect(str(analytics)) as db:
            db.execute("create schema if not exists raw")
            db.register("budget_frame", frame)
            db.execute("create or replace table raw.budget_frames as select * from budget_frame")
    coverage = {"generated_at": datetime.now(timezone.utc).isoformat(), "documents": documents,
                "rows": len(frames), "errors": errors,
                "note": "Partikolumner är avvikelser från regeringens förslag; amount_msek är omräknat totalförslag."}
    (root / "budget_coverage.json").write_text(
        json.dumps(coverage, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"documents": len(documents), "rows": len(frames), "errors": len(errors)}))


if __name__ == "__main__":
    main()
