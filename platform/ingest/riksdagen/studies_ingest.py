"""Fetch government studies (SOU, Ds) and what each government bill says it was based on.

    python platform/ingest/riksdagen/studies_ingest.py                  # 2006 to now
    python platform/ingest/riksdagen/studies_ingest.py --session 2024/25

Stored under warehouse/raw/riksdagen/studies/ with provenance:

    sou/<year>-<page>.json          Statens offentliga utredningar published that year
    ds/<year>-<page>.json           Departementsserien published that year
    propositions/<rm>-<page>.json   the session's government bills (propositioner)
    preparation/<rm>.jsonl.gz       one line per bill: the committee reports it was dealt
                                    with in, and the studies it cites as its preparation

A bill's preparation is read from its sections "Ärendet och dess beredning" (a budget bill
has one per proposal), where the government names the inquiry report (SOU), departmental
memo (Ds) or ministry memorandum (promemoria) the proposal rests on. A bill without such
a section counts a study only where the sentence citing it says it was referred for
comment (remiss). The extraction is kept with the bill's URL, so each
link can be checked against the bill itself.
"""
from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import rawstore  # noqa: E402

SOURCE = "riksdagen"
API = "https://data.riksdagen.se"
FIRST_YEAR = 2006

SOU = re.compile(r"\bSOU\s?(\d{4}):\s?(\d{1,3})\b")
DS = re.compile(r"\bDs\s?(\d{4}):\s?(\d{1,3})\b")
RIR = re.compile(r"\bRiR\s?(\d{4}):\s?(\d{1,3})\b")
DIARY = re.compile(r"(?:\(|dnr\s)((?:Fi|Ju|S|U|N|M|A|Ku|I|Fö|UD|Kn|LI|KN|Jo)\d{4}/\d{3,6}(?:/[\w-]+)?)\b")
MEMO = re.compile(
    r"promemorian\s+(?:”|\")?([A-ZÅÄÖ][^.”\"]{4,180}?)(?:”|\")?\s+"
    r"(?:\((?:[A-ZÅÄÖ][\wåäö]{0,3}\s?\d{4}/\d+[^)]*)\)\s+)?"
    r"(?:utarbetats|tagits fram|upprättats|remitterats|remissbehandlats)")
# Without a preparation section, a citation counts only where the sentence says the study
# was referred for comment: the step that makes it the basis of a bill.
PREPARATION_WORDS = re.compile(r"remiss", re.IGNORECASE)
HEADING = "Ärendet och dess beredning"


def plain(text: str) -> str:
    for _ in range(2):
        text = html.unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    # Words hyphenated across a line break in the printed bill: "remissbehand- lats".
    return re.sub(r"(\w)- ([a-zåäö])", r"\1\2", text).strip()


def preparation_sections(text: str) -> list[tuple[str, str]]:
    """Every 'Ärendet och dess beredning' section with its number, skipping the contents.

    An ordinary bill has one; a budget bill has one per proposal in its tax chapters,
    numbered like "12.1.1", so a study can be tied to the proposal it prepared.
    """
    sections = []
    for match in re.finditer(r"(?:(\d{1,2}(?:\.\d{1,2}){0,3})\s+)?" + re.escape(HEADING), text):
        following = text[match.end():match.end() + 40]
        if "...." in following or "…" in following:
            continue
        start = match.start() + (len(match.group(0)) - len(HEADING))
        body = text[start:start + 8000]
        # The next numbered heading ends the section, e.g. "4 Bakgrund" or "12.3.2 Skälen".
        end = re.search(r"\s\d{1,2}(?:\.\d{1,2}){0,3}\s+(?:Bakgrund|Gällande|Nuvarande|"
                        r"Överväganden|Förslag|Skälen|Konsekvenser|Ikraftträdande|"
                        r"Författningskommentar|Proposition|Regeringens)", body[len(HEADING):])
        # The number of the proposal the section belongs to: "12.1.1" belongs to "12.1".
        number = match.group(1) or ""
        proposal = number.rsplit(".", 1)[0] if number.count(".") >= 1 else number
        sections.append((proposal, body[:len(HEADING) + end.start()] if end else body[:4000]))
    return sections


def references(text: str, *, whole_document: bool) -> list[dict]:
    """Studies cited as preparation. In a whole document, only where a sentence says so.

    There, the sentence before a remiss sentence is read too: "Utredningen överlämnade
    betänkandet X (SOU 2020:1). Betänkandet har remissbehandlats."
    """
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-ZÅÄÖ])", text)
    found: dict[tuple[str, str], dict] = {}
    for index, sentence in enumerate(sentences):
        if whole_document:
            if not PREPARATION_WORDS.search(sentence):
                continue
            sentence = " ".join(sentences[max(index - 1, 0):index + 1])
        context = sentence[:400]
        for kind, pattern in (("sou", SOU), ("ds", DS), ("rir", RIR)):
            for year, number in pattern.findall(sentence):
                key = f"{year}:{int(number)}"
                found.setdefault((kind, key), {"kind": kind, "key": key, "title": "",
                                                "diary": "", "context": context})
        memos = list(MEMO.finditer(sentence))
        for memo in memos:
            title = memo.group(1).strip(" ,;")
            if title.lower().startswith(("föreslås", "finns", "lagförslag")):
                continue
            diary = DIARY.search(sentence[memo.start():memo.end() + 80])
            found.setdefault(("pm", title.lower()), {
                "kind": "pm", "key": title, "title": title,
                "diary": diary.group(1) if diary else "", "context": context})
        # An untitled memo known by its diary number: "Promemorian har remitterats (dnr Fi2008/3983)".
        if not memos and re.search(r"promemori", sentence, re.IGNORECASE):
            for diary in DIARY.findall(sentence):
                if not any(item["diary"] == diary for item in found.values()):
                    found.setdefault(("pm", diary), {"kind": "pm", "key": diary, "title": "",
                                                     "diary": diary, "context": context})
    return list(found.values())


def sessions_until_now() -> list[str]:
    today = date.today()
    last = today.year if today.month >= 9 else today.year - 1
    return [f"{year}/{str(year + 1)[-2:]}" for year in range(FIRST_YEAR, last + 1)]


def code(session: str) -> str:
    return session.replace("/", "")


def listing(http, doc_type: str, period: str, target: str) -> list[dict]:
    """Every page of a document listing, stored; returns the documents."""
    documents: list[dict] = []
    page = 1
    while True:
        query = urllib.parse.urlencode({"doktyp": doc_type, "rm": period, "sz": 500, "p": page,
                                        "utformat": "json", "sort": "datum", "sortorder": "asc"})
        url = f"{API}/dokumentlista/?{query}"
        path = rawstore.fetch(http, SOURCE, f"studies/{target}-{page:02d}.json", url, pause=0.3)
        result = json.loads(path.read_text(encoding="utf-8-sig"))["dokumentlista"]
        rows = result.get("dokument") or []
        documents.extend(rows if isinstance(rows, list) else [rows])
        if page >= int(result.get("@sidor") or 1):
            return documents
        page += 1


def as_list(value) -> list:
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def preparation(http, document: dict) -> dict:
    dok_id = document["dok_id"]
    url = f"{API}/dokumentstatus/{urllib.parse.quote(dok_id)}.json"
    response = http.get(url, timeout=300)
    response.raise_for_status()
    status = json.loads(response.content.decode("utf-8-sig"))["dokumentstatus"]
    head = status["dokument"]
    text = plain(head.get("html") or "")
    sections = preparation_sections(text)
    section = " ".join(body for _, body in sections)
    cited = []
    for proposal, body in sections:
        for item in references(body, whole_document=False):
            if (item["kind"], item["key"].lower()) not in {(c["kind"], c["key"].lower()) for c in cited}:
                cited.append({**item, "section": proposal})
    # A budget bill also prepares proposals outside any such section; a bill without the
    # section is read the same way.
    if not section or head.get("beteckning") in {"1", "100"}:
        keys = {(item["kind"], item["key"].lower()) for item in cited}
        cited += [{**item, "section": ""} for item in references(text, whole_document=True)
                  if (item["kind"], item["key"].lower()) not in keys]
    reports = [
        {"report_id": ref.get("ref_dok_id") or "", "session": ref.get("ref_dok_rm") or "",
         "designation": ref.get("ref_dok_bet") or "", "title": ref.get("ref_dok_titel") or ""}
        for ref in as_list((status.get("dokreferens") or {}).get("referens"))
        if ref.get("referenstyp") == "behandlas_i" and ref.get("ref_dok_typ") == "bet"
    ]
    facts = {item.get("kod"): item.get("text")
             for item in as_list((status.get("dokuppgift") or {}).get("uppgift"))}
    return {
        "prop_id": dok_id,
        "session": head.get("rm") or "",
        "number": head.get("beteckning") or "",
        "title": plain(head.get("titel") or ""),
        "date": str(head.get("datum") or "")[:10],
        "department": facts.get("inlamnatav") or "",
        "committee": facts.get("tilldelat") or "",
        "reports": reports,
        "has_section": bool(section),
        "section": section[:12000],
        "references": cited,
        "source_url": f"{API}/dokument/{dok_id}",
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def stored_preparation(session: str) -> dict[str, dict]:
    path = rawstore.RAW / SOURCE / f"studies/preparation/{code(session)}.jsonl.gz"
    if not path.is_file():
        return {}
    lines = gzip.decompress(path.read_bytes()).decode("utf-8").splitlines()
    return {record["prop_id"]: record for record in map(json.loads, lines)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--session", action="append", help="e.g. 2024/25; default: every session")
    parser.add_argument("--refetch-closed", action="store_true",
                        help="also re-read bills of sessions that closed more than a year ago")
    parser.add_argument("--reread", action="append", default=[],
                        help="bill numbers to read again in every session, e.g. 1 for budget bills")
    arguments = parser.parse_args()
    http = rawstore.session()
    sessions = arguments.session or sessions_until_now()
    open_sessions = set(sessions_until_now()[-2:])

    if not arguments.session:
        this_year = date.today().year
        for year in range(FIRST_YEAR, this_year + 1):
            sou = listing(http, "sou", str(year), f"sou/{year}")
            ds = listing(http, "ds", str(year), f"ds/{year}")
            print(f"{year}: {len(sou)} SOU, {len(ds)} Ds", flush=True)

    for session in sessions:
        known = stored_preparation(session)
        closed = session not in open_sessions
        if (known and closed and not arguments.session and not arguments.refetch_closed
                and not arguments.reread):
            continue
        bills = listing(http, "prop", session, f"propositions/{code(session)}")
        records: dict[str, dict] = {}
        pending = []
        for bill in bills:
            previous = known.get(bill["dok_id"])
            # A bill's text does not change; its committee report is added once it is dealt with.
            if previous and previous["reports"] and bill.get("beteckning") not in arguments.reread:
                records[bill["dok_id"]] = previous
            else:
                pending.append(bill)

        def read(bill: dict) -> dict | None:
            try:
                return preparation(http, bill)
            except Exception as error:  # one broken bill must not stop the session
                print(f"  {bill['dok_id']}: {error}", flush=True)
                return known.get(bill["dok_id"])

        # A few bills at a time: Riksdagen's API is shared, and a budget bill is 10 MB.
        with ThreadPoolExecutor(max_workers=4) as pool:
            for bill, record in zip(pending, pool.map(read, pending)):
                if record:
                    records[bill["dok_id"]] = record
        records = [records[bill["dok_id"]] for bill in bills if bill["dok_id"] in records]
        payload = "\n".join(json.dumps(r, ensure_ascii=False) for r in records) + "\n"
        rawstore.store(SOURCE, f"studies/preparation/{code(session)}.jsonl.gz",
                       payload.encode("utf-8"),
                       url=f"{API}/dokumentstatus/<prop>.json (rm={session})")
        cited = sum(1 for r in records if r["references"])
        print(f"{session}: {len(records)} bills, {cited} cite a study", flush=True)


if __name__ == "__main__":
    main()
