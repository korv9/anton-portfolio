"""Append immutable, deduplicated API payload versions to local DuckDB."""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path

import duckdb
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API = 'https://jobsearch.api.jobtechdev.se/search'


def jobsearch_session():
    session = requests.Session()
    session.mount('https://', HTTPAdapter(max_retries=Retry(
        total=4, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])))
    return session


def fetch_search(session, params, max_pages, *, observe=None, sleep=time.sleep, allow_window_split=False):
    """Shared bounded search, with explicit coverage for the current-ad consumer."""
    ads, totals, pages = [], [], 0
    split = False
    for page in range(max_pages):
        sleep(0.25)
        query = {**params,'limit':100,'offset':page*100}
        response = session.get(API,params=query,timeout=60)
        response.raise_for_status()
        if observe:
            observe(response,query)
        body = response.json()
        hits = body['hits']
        if not isinstance(hits,list):
            raise ValueError('API hits must be a list')
        total = body.get('total',{})
        total = total.get('value') if isinstance(total,dict) else total
        if type(total) is not int or total < 0:
            raise ValueError('API total must be a nonnegative integer')
        totals.append(total)
        pages += 1
        ads.extend(hits)
        if total > 2000 and allow_window_split:
            split = True
            break
        if len(hits) < 100 or len(ads) >= total:
            break
    unique = {str(ad['id']) for ad in ads}
    return ads, {'pages':pages,'source_totals':totals,'observed':len(unique),'requires_window_split':split,
        'complete':bool(totals and not split and len(set(totals)) == 1 and len(unique) == totals[0])}


def fetch_jobs(queries, max_pages):
    ads = []
    with jobsearch_session() as session:
        for query in queries:
            found,coverage = fetch_search(session,{'q':query},max_pages)
            ads.extend(found)
            if not coverage['complete']:
                print(f'Page cap reached for {query!r}; this may be a partial sample.')
    return ads


def ingest(ads, database, source_kind):
    # Validate the complete batch before writing; failures leave no partial batch.
    rows = []
    for ad in ads:
        if not isinstance(ad, dict) or not str(ad.get('id') or '').strip():
            raise ValueError('Every advertisement requires a non-empty id')
        payload = json.dumps(ad, sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        rows.append((str(ad['id']), digest, payload, source_kind))
    Path(database).parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(database)) as con:
        con.execute('create schema if not exists raw')
        con.execute('''create table if not exists raw.collection_coverage (
            publication_month date primary key, source_uri varchar, source_sha256 varchar,
            source_rows bigint, candidate_rows bigint, completed_at timestamptz,
            status varchar, scope_version varchar)''')
        con.execute('create sequence if not exists raw.ingestion_seq')
        con.execute('''create table if not exists raw.job_ads (
            job_id varchar not null, payload_hash varchar not null, payload json not null,
            source_kind varchar not null, ingested_at timestamptz default current_timestamp,
            ingestion_id bigint primary key default nextval('raw.ingestion_seq'))''')
        kinds = {r[0] for r in con.execute('select distinct source_kind from raw.job_ads').fetchall()}
        if kinds and kinds != {source_kind}:
            raise ValueError('Use separate databases for fixture, live and historical data')
        before = con.execute('select count(*) from raw.job_ads').fetchone()[0]
        con.execute('begin')
        try:
            latest = dict(con.execute('''select job_id, payload_hash from raw.job_ads
                qualify row_number() over (partition by job_id order by ingestion_id desc) = 1''').fetchall())
            # Deduplicate overlapping query results; last observation wins in a batch.
            for row in {row[0]: row for row in rows}.values():
                if latest.get(row[0]) != row[1]:
                    con.execute('''insert into raw.job_ads
                        (job_id, payload_hash, payload, source_kind) values (?, ?, ?, ?)''', row)
            con.execute('commit')
        except Exception:
            con.execute('rollback')
            raise
        after = con.execute('select count(*) from raw.job_ads').fetchone()[0]
    return after - before


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--query', action='append', help='Repeat for multiple search terms')
    parser.add_argument('--max-pages', type=int, default=3)
    parser.add_argument('--database', default=os.getenv('JOB_MARKET_DB', 'data/job_market.duckdb'))
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 20:
        parser.error('--max-pages must be between 1 and 20')
    ads = (json.loads(args.fixture.read_text(encoding='utf-8')) if args.fixture else
           fetch_jobs(args.query or ['data engineer', 'analytics engineer', 'data scientist'], args.max_pages))
    added = ingest(ads, args.database, 'fixture' if args.fixture else 'live')
    print(f'Received {len(ads)} ads; added {added} new payload versions to {args.database}')


if __name__ == '__main__':
    main()
