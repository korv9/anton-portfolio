# Political news

`#now-news` lists political news from **SVT Nyheter**, **Sveriges Radio Ekot** and the
**Government Offices**, tagged by party and topic. The latest items on forming a government
also appear under `#now-government`, and each party's page (`#parties-<code>`) shows the news
naming it.

## What is kept

Only what the feeds themselves publish: the headline, the feed's own short summary, the time
and the link. Every item links to the article, which stays with its publisher; article text is
never fetched. SVT's robots.txt allows real-time retrieval (not AI training).

| Source | Feed |
|---|---|
| SVT Nyheter | `https://www.svt.se/nyheter/rss.xml` (RSS, about 100 latest items) |
| Sveriges Radio Ekot | `https://api.sr.se/api/rss/program/83` (Atom, 20 latest; SR's open API) |
| Government Offices | `https://www.regeringen.se/Filter/RssFeed?filterType=Taxonomy` (RSS, 100 latest, with ministry and policy area as categories) |

SVT sometimes answers 403 to automated requests. A failing source is logged and skipped; the
others are still read, and the next run tries again.

## Pipeline

1. **Collect** — `platform/ingest/news/news_ingest.py` reads the feeds and merges new items
   into a monthly archive, `warehouse/raw/news/items-YYYY-MM.jsonl` (one line per item, with
   when it was first and last seen), and logs every fetch in `_manifest.jsonl`. The feeds
   hold only a day or so, so the archive is built by reading often; it starts the day
   collection started. With `--sync` the archive lives on R2 (`raw/news/`) between runs.
2. **Tag** — dbt, tag `news` (`platform/models/{bronze,gold}/news`):
   - parties by the way newsrooms write them, case-sensitive: "(S)", "S-ledaren", "SD:s",
     "Vänsterpartiet" (`seeds/news/news_party_terms.csv`);
   - topics by keyword: forming a government and the site's 15 policy issues
     (`seeds/news/news_topics.csv`);
   - political: from the Government, naming a party, about forming a government, or using the
     words of national politics.
3. **Export** — `platform/publish/export_news.py` writes `frontend/public/data/parliament/news.json`:
   the political items of the last 60 days, topics, items per party in 30 days, and each
   source's last fetch.
4. **Schedule** — `.github/workflows/refresh-news.yml`, every three hours; commits `news.json`
   when an item changed. It needs the R2 secrets (docs/deploy.md) and does nothing without them.

```
python platform/ingest/news/news_ingest.py
cd platform && dbt build --select tag:news && cd ..
python platform/publish/export_news.py
```

## Limits

- Keyword tagging: an item can name a party without being about it (an analysis naming five
  parties is tagged with all five), and a topic word can match in passing.
- No history before collection started; the feeds cannot be read backwards.
