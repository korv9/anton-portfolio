"""The Commission's guidance pages: title and publication date read from each page.

One row per page, from its latest stored version, with the number of distinct versions seen
and when the page was first and last fetched. Title: the page's `og:title`. Publication date:
the page header's "Publication <date>" line where the page has one (library pages); policy pages
carry none and keep a null rather than a guessed date.
"""
import html
import re
import sys
from pathlib import Path

import pandas as pd


def model(dbt, session):
    dbt.config(materialized="table")
    sys.path.insert(0, str(Path.cwd()))
    from legal.parse import english_date

    pages = dbt.ref("stg_ai_act_guidance_pages").df()
    rows = []
    for guidance_id, versions in pages.groupby("guidance_id"):
        versions = versions.sort_values("last_fetched_at")
        latest = versions.iloc[-1]
        page = latest["html"]
        title = re.search(r'property="og:title"\s+content="([^"]+)"', page) or \
            re.search(r"<title>([^<|]+)", page)
        meta = re.search(r'ecl-page-header__meta-item">\s*(?:Publication|News article|Report|Factsheet)?\s*'
                         r'(\d{1,2} \w+ \d{4})\s*<', page)
        rows.append({
            "guidance_id": guidance_id,
            "kind": latest["kind"],
            "title": html.unescape(title.group(1)).strip() if title else None,
            "published_at": english_date(meta.group(1)) if meta else None,
            "published_basis": "page header" if meta else None,
            "source_url": latest["source_url"],
            "articles_json": latest["articles_json"],
            "source_hash": latest["source_hash"],
            "first_fetched_at": versions["first_fetched_at"].min(),
            "last_fetched_at": latest["last_fetched_at"],
            "version_count": len(versions),
        })
    frame = pd.DataFrame(rows)
    frame["published_at"] = pd.to_datetime(frame["published_at"]).dt.date
    return frame
