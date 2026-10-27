# Political news

`frontend/public/data/parliament/news.json` holds political news from **SVT Nyheter**,
**Sveriges Radio Ekot** and the **Government Offices**, tagged by party and topic. The news pages
of the Political Observatory were withdrawn on 2026-10-21; the chart feed reads the file
(`frontend/src/meaning/posts/pol-docs-a.tsx`).

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

1. **Collect**: `platform/ingest/news/news_ingest.py` reads the feeds and merges new items
   into a monthly archive, `warehouse/raw/news/items-YYYY-MM.jsonl` (one line per item, with
   when it was first and last seen), and logs every fetch in `_manifest.jsonl`. The feeds
   hold only a day or so, so the archive is built by reading often; it starts the day
   collection started. With `--sync` the archive lives on R2 (`raw/news/`) between runs.
2. **Tag**: dbt, tag `news` (`platform/models/{bronze,gold}/news`):
   - parties by the way newsrooms write them, case-sensitive: "(S)", "S-ledaren", "SD:s",
     "Vänsterpartiet", "Tidöpartierna" (`seeds/news/news_party_terms.csv`);
   - parties by the full name of a politician in office now, for news that names a minister
     without the party ("Ebba Busch", "socialminister Jakob Forssmed"). The names come from
     Riksdagen's person list (`platform/ingest/news/people_ingest.py`, members serving,
     ministers, Speakers, MEPs). A name two people share is left out, and so is an ordinary
     member with one of the thirty most common Swedish surnames ("Johan Andersson" in the
     news is more often someone else); ministers and Speakers always count;
   - topics by keyword: forming a government and the site's 15 policy issues
     (`seeds/news/news_topics.csv`);
   - political: from the Government, naming a party, about forming a government, or using the
     words of national politics.
3. **Export**: `platform/publish/export_news.py` writes `frontend/public/data/parliament/news.json`:
   the political items of the last 60 days, topics, items per party in 30 days, and each
   source's last fetch.
4. **Summarise**: `platform/publish/summarize_news.py` writes
   `parliament/news-summaries.json`, a summary of the last seven days with the articles it
   cites. It runs only when `ANTHROPIC_API_KEY` is set. See below for what happens when it fails.
5. **Schedule**: `.github/workflows/refresh-news.yml`, every morning at 05:17 UTC. It publishes
   the `news` delivery group to R2 and commits nothing. It needs the R2 secrets
   ([deploy.md](deploy.md)).

```sh
python platform/pipeline.py run news                 # all of it
python platform/pipeline.py run news --only dbt      # one phase
```

## The summary is optional

Fetching, the archive, tagging, dbt and the export are required: a failure stops the run. The
summary is not. The summariser never changes `news.json`, and it writes a new
`news-summaries.json` only after a complete answer that passes the schema and cites known
articles. In every other case the previous summary stays byte for byte, with its own
`generated_at` and `period`. No replacement text is written when there is no earlier summary.

| Exit code | Status | What the run does |
|---|---|---|
| 0 | `generated` or `skipped` | Continues. `skipped` has the reason `no_key` or `no_recent_items` |
| 2 | `degraded` | Continues and publishes the headlines with the previous summary |
| 1 | `failed` | Stops: a local input, output or status-file error, or bad arguments |

Code 2 covers `refusal`, `max_tokens`, `unexpected_stop`, `api_error`, `sdk_unavailable`,
`invalid_response` and `ungrounded_response`. A summary is ungrounded when it cites an unknown
article id, or names a party that the cited articles' tags do not support.

Before it fetches, the run restores the last approved summary from R2
(`release.py materialize --prefer-active`), so a failed attempt publishes that one and not an
older copy from the checkout. `--status-file` writes the attempt's status as JSON outside the
public data: status, reason, exit code, `attempted_at`, model, items considered and the active
summary's date and period. An API error is recorded by exception type and HTTP status, without
the response body or the key. The client has a 60-second timeout and does not retry.

The citation and schema checks do not show that each sentence renders its source correctly.
The summary's wording still needs a human read.

## Limits

- Keyword tagging: an item can name a party without being about it (an analysis naming five
  parties is tagged with all five), and a topic word can match in passing.
- No history before collection started; the feeds cannot be read backwards. Until the
  archive is 30 days old, the count by each party covers the time since collection started,
  and the export says so (`collected_since`).
