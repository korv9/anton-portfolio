"""The news export and the news delivery check agree: an item dated ahead of the clock (a feed's
wrong offset) waits for its time instead of failing the whole news publication."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

import export_news
import validate_refresh_delivery as check


def test_a_future_dated_item_waits_and_the_export_passes_its_check(tmp_path, monkeypatch):
    db = tmp_path / "w.duckdb"
    now = datetime.now(timezone.utc)
    con = duckdb.connect(str(db))
    con.execute("create schema gold; create schema seeds")
    con.execute("""create table gold.fct_news_item (item_id varchar, source varchar, title varchar,
        summary varchar, url varchar, published_at timestamptz, first_seen timestamptz,
        parties varchar[], topics varchar[], is_political boolean)""")
    for item, at in (("past", now - timedelta(hours=2)), ("ahead", now + timedelta(hours=3))):
        con.execute("insert into gold.fct_news_item values (?, 'svt', 't', 's', 'https://svt.se/x', ?, ?, ['S'], [], true)",
                    [item, at, now - timedelta(hours=1)])
    con.execute("create table gold.fct_news_item_party as select 'S' as party, 'past' as item_id")
    con.execute("create table seeds.news_topics (topic varchar, name_sv varchar, name_en varchar)")
    con.execute("""create table gold.mart_news_fetch_status as select 'svt' as source, now() as last_fetch,
        now() as last_success, 200 as last_status, null::varchar as last_error, 1 as fetches, 0 as failed_fetches""")
    con.close()
    out = tmp_path / "parliament/news.json"
    monkeypatch.setattr(export_news, "DATABASE", db)
    monkeypatch.setattr(export_news, "OUT", out)
    export_news.main()
    data = json.loads(out.read_text(encoding="utf-8"))
    assert [i["id"] for i in data["items"]] == ["past"]
    assert check.validate_delivery("news", tmp_path)["warnings"] == []
