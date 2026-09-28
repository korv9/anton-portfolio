"""Export the political news to the site.

    python platform/publish/export_news.py

Writes frontend/public/data/parliament/news.json from the gold news models (dbt tag:news):
the latest political items (headline, the feed's summary, time, link, parties, topics), the
topics, how many items named each party in the last 30 days, and each source's last fetch.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

import duckdb  # noqa: E402

from common import PUBLIC, ROOT, write_json  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = PUBLIC / "parliament/news.json"
MAX_ITEMS = 600
DAYS = 60
SUMMARY_LIMIT = 280
SOURCES = {
    "svt": {"name": "SVT Nyheter", "url": "https://www.svt.se/nyheter/"},
    "ekot": {"name": "Sveriges Radio Ekot", "url": "https://www.sverigesradio.se/ekot"},
    "regeringen": {"name": "Regeringskansliet", "url": "https://www.regeringen.se/"},
}


def main() -> None:
    connection = duckdb.connect(str(DATABASE), read_only=True)
    items = []
    for item_id, source, title, summary, url, published, parties, topics in connection.execute(f"""
            select item_id, source, title, summary, url, published_at, parties, topics
            from gold.fct_news_item
            where is_political and published_at >= now() - interval {DAYS} day
              and published_at <= now() + interval 1 day
            order by published_at desc limit {MAX_ITEMS}""").fetchall():
        if summary and len(summary) > SUMMARY_LIMIT:
            summary = summary[:SUMMARY_LIMIT].rsplit(" ", 1)[0] + " …"
        items.append({"id": item_id, "source": source, "title": title, "summary": summary,
                      "url": url, "published_at": published.astimezone(timezone.utc).isoformat(),
                      "parties": parties, "topics": topics})
    topics = [{"key": k, "name_sv": sv, "name_en": en} for k, sv, en in connection.execute(
        "select topic, name_sv, name_en from seeds.news_topics order by name_sv").fetchall()]
    party_counts = dict(connection.execute("""
        select p.party, count(*) from gold.fct_news_item_party as p
        join gold.fct_news_item as n using (item_id)
        where n.is_political and n.published_at >= now() - interval 30 day
        group by 1""").fetchall())
    status = {}
    for source, last_fetch, last_success, last_status, last_error, fetches, failed in \
            connection.execute("select * from gold.mart_news_fetch_status").fetchall():
        status[source] = {**SOURCES.get(source, {"name": source, "url": None}),
                          "last_fetch": last_fetch and last_fetch.isoformat(),
                          "last_success": last_success and last_success.isoformat(),
                          "last_status": last_status, "last_error": last_error,
                          "fetches": fetches, "failed_fetches": failed}
    write_json(OUT, {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "days": DAYS,
        "sources": status,
        "topics": topics,
        "party_counts_30d": party_counts,
        "items": items,
        "method": ("Headlines and the feeds' own summaries from SVT Nyheter, Sveriges Radio Ekot "
                   "and the Government Offices, collected every few hours; each links to the "
                   "article, which stays with its publisher. Items are tagged with the parties "
                   "they name, the way newsrooms write them ('(S)', 'SD:s', 'Vänsterpartiet'), "
                   "and topics by keyword; an item can name a party without being about it."),
    })
    print(f"news: {len(items)} political items in {DAYS} days; parties {party_counts}")


if __name__ == "__main__":
    main()
