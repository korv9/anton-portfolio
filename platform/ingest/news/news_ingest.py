"""Collect news headlines on Swedish politics: SVT, Sveriges Radio Ekot and the Government.

    python platform/ingest/news/news_ingest.py            # fetch, merge into the archive
    python platform/ingest/news/news_ingest.py --sync     # also pull and push the archive on R2
    python platform/ingest/news/news_ingest.py --sync --months 3   # pull three months, for the export

The feeds only hold the latest items (SVT about 100, Ekot 20), so this runs every few hours
and keeps what it sees: an archive per month, warehouse/raw/news/items-YYYY-MM.jsonl, one line
per item. Only what the feed itself publishes is kept: headline, the feed's own short summary,
the time, and the link to the article, which stays with its publisher. Article text is never
fetched.

Sources:
    svt          https://www.svt.se/nyheter/rss.xml (RSS 2.0; robots.txt allows real-time retrieval)
    ekot         https://api.sr.se/api/rss/program/83 (Sveriges Radio's open API, Atom)
    regeringen   https://www.regeringen.se/Filter/RssFeed (RSS 2.0: press releases, articles, calendar)

A source that fails (SVT sometimes answers 403 to automated requests) is logged in the
manifest and skipped; the others are still collected. Every fetch appends a line to
warehouse/raw/news/_manifest.jsonl: URL, time, status, SHA-256 and size of the payload, items
read and items new.

The runner's disk is empty on every run, so with --sync the latest months (--months, default 2)
and the fetch log are downloaded from the R2 bucket first (keys raw/news/items-YYYY-MM.jsonl
and raw/news/_manifest.jsonl) and uploaded after the merge. Without
bucket credentials --sync warns and keeps the archive local.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import RAW, session  # noqa: E402

OUT = RAW / "news"
PREFIX = "raw/news/"
SOURCES = {
    "svt": "https://www.svt.se/nyheter/rss.xml",
    "ekot": "https://api.sr.se/api/rss/program/83",
    "regeringen": "https://www.regeringen.se/Filter/RssFeed?filterType=Taxonomy",
}
ATOM = "{http://www.w3.org/2005/Atom}"
TAGS = re.compile(r"<[^>]+>")


def clean(text: str | None) -> str:
    """Plain text from a feed field that may hold escaped, even twice-escaped, HTML."""
    text = text or ""
    for _ in range(3):
        unescaped = html.unescape(text)
        if unescaped == text:
            break
        text = unescaped
    return re.sub(r"\s+", " ", TAGS.sub(" ", text)).strip()


def iso(value: str | None) -> str | None:
    """An RFC 822 (RSS) or ISO 8601 (Atom) time as ISO 8601 in UTC."""
    if not value:
        return None
    try:
        moment = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).isoformat(timespec="seconds")


def parse(source: str, payload: bytes) -> list[dict]:
    """Items of an RSS 2.0 or Atom feed: id, title, summary, url, published time."""
    root = ET.fromstring(payload)
    items = []
    for node in root.iter("item"):
        url = (node.findtext("link") or "").strip()
        items.append({
            "id": f"{source}:{(node.findtext('guid') or url).strip()}",
            "source": source,
            "title": clean(node.findtext("title")),
            "summary": clean(node.findtext("description")),
            "url": url,
            "published_at": iso(node.findtext("pubDate")),
            "categories": [clean(c.text) for c in node.findall("category") if c.text],
        })
    for node in root.iter(f"{ATOM}entry"):
        link = node.find(f"{ATOM}link")
        url = link.get("href", "") if link is not None else ""
        items.append({
            "id": f"{source}:{(node.findtext(f'{ATOM}id') or url).strip()}",
            "source": source,
            "title": clean(node.findtext(f"{ATOM}title")),
            "summary": clean(node.findtext(f"{ATOM}summary")),
            "url": url,
            "published_at": iso(node.findtext(f"{ATOM}published")
                                or node.findtext(f"{ATOM}updated")),
            "categories": [],
        })
    return [i for i in items if i["title"] and i["url"]]


def month_path(item: dict) -> Path:
    return OUT / f"items-{(item['published_at'] or item['first_seen'])[:7]}.jsonl"


def read_month(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    return {row["id"]: row for row in map(json.loads, path.read_text(encoding="utf-8").splitlines())
            if row}


def merge(items: list[dict], now: str) -> dict[Path, int]:
    """Add items to their month files; a known item keeps first_seen and gets the latest text."""
    by_month: dict[Path, list[dict]] = {}
    for item in items:
        item = {**item, "first_seen": now, "last_seen": now}
        by_month.setdefault(month_path(item), []).append(item)
    added = {}
    for path, fresh in by_month.items():
        rows = read_month(path)
        new = 0
        for item in fresh:
            if item["id"] in rows:
                known = rows[item["id"]]
                item["first_seen"] = known["first_seen"]
            else:
                new += 1
            rows[item["id"]] = item
        path.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(rows.values(), key=lambda r: (r["published_at"] or "", r["id"]))
        path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in ordered),
                        encoding="utf-8")
        added[path] = new
    return added


def bucket():
    """The R2 client and bucket, or None without credentials."""
    names = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")
    if not all(os.environ.get(n) for n in names):
        print("::warning::No R2 credentials: the news archive stays local this run", flush=True)
        return None
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish"))
    from upload import client  # noqa: E402
    return client()


def pull(s3, name: str, months: list[str]) -> None:
    for month in months:
        target = OUT / f"items-{month}.jsonl"
        try:
            body = s3.get_object(Bucket=name, Key=f"{PREFIX}{target.name}")["Body"].read()
        except s3.exceptions.NoSuchKey:
            continue
        remote = {r["id"]: r for r in map(json.loads, body.decode("utf-8").splitlines()) if r}
        local = read_month(target)
        for key, row in local.items():
            if key in remote:
                row["first_seen"] = min(row["first_seen"], remote[key]["first_seen"])
            remote[key] = row
        target.parent.mkdir(parents=True, exist_ok=True)
        ordered = sorted(remote.values(), key=lambda r: (r["published_at"] or "", r["id"]))
        target.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in ordered),
                          encoding="utf-8")


def pull_log(s3, name: str) -> None:
    """The fetch log from R2, with any local lines not yet in it after."""
    target = OUT / "_manifest.jsonl"
    try:
        remote = s3.get_object(Bucket=name, Key=f"{PREFIX}{target.name}")["Body"].read().decode()
    except s3.exceptions.NoSuchKey:
        return
    local = target.read_text(encoding="utf-8") if target.exists() else ""
    lines = remote.splitlines() + [x for x in local.splitlines() if x not in set(remote.splitlines())]
    target.write_text("".join(line + "\n" for line in lines if line), encoding="utf-8")


def months_back(now: str, count: int) -> list[str]:
    year, month = int(now[:4]), int(now[5:7])
    out = []
    for _ in range(count):
        out.append(f"{year}-{month:02d}")
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return out[::-1]


def push(s3, name: str, paths: list[Path]) -> None:
    for path in paths:
        s3.put_object(Bucket=name, Key=f"{PREFIX}{path.name}", Body=path.read_bytes(),
                      ContentType="application/x-ndjson")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sync", action="store_true", help="Pull and push the archive on R2")
    parser.add_argument("--months", type=int, default=2,
                        help="Months of the archive to pull from R2 with --sync (default 2)")
    parser.add_argument("--sources", nargs="+", choices=sorted(SOURCES), default=sorted(SOURCES))
    args = parser.parse_args()

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    OUT.mkdir(parents=True, exist_ok=True)
    s3 = bucket() if args.sync else None
    if s3:
        # The feeds reach back a day or two, so two months cover them; the export wants more.
        pull(*s3, months_back(now, max(args.months, 2)))
        pull_log(*s3)

    http = session()
    http.headers["User-Agent"] = ("Mozilla/5.0 (compatible; anton-portfolio-news/1.0; "
                                  "+https://github.com/korv9/anton-portfolio)")
    items, log = [], []
    for source in args.sources:
        url = SOURCES[source]
        entry = {"source": source, "url": url, "fetched_at": now}
        try:
            response = http.get(url, timeout=30)
            entry["status"] = response.status_code
            response.raise_for_status()
            found = parse(source, response.content)
            entry.update(sha256=hashlib.sha256(response.content).hexdigest(),
                         bytes=len(response.content), items=len(found))
            items += found
        except Exception as error:  # noqa: BLE001 - one source failing must not stop the rest
            entry["error"] = str(error).splitlines()[0][:200]
            print(f"::warning::{source}: {entry['error']}", flush=True)
        log.append(entry)

    added = merge(items, now)
    new = sum(added.values())
    with (OUT / "_manifest.jsonl").open("a", encoding="utf-8") as manifest:
        for entry in log:
            manifest.write(json.dumps(entry, ensure_ascii=False) + "\n")
    if s3:
        push(*s3, sorted(added) + [OUT / "_manifest.jsonl"])
    for entry in log:
        print(f"{entry['source']}: {entry.get('items', 0)} items"
              + (f" ({entry['error']})" if "error" in entry else ""))
    print(f"news: {len(items)} items read, {new} new, in {len(added)} month file(s)")
    if not items:
        sys.exit("No source answered")


if __name__ == "__main__":
    main()
