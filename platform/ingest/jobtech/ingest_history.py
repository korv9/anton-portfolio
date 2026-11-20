"""Stream JobTech's yearly and quarterly ZIP/JSONL archives, and the JobStream answers after the
last of them, retaining role candidates and month coverage."""
import argparse
from collections import Counter
from datetime import date, timedelta
import gzip
import hashlib
import json
from pathlib import Path
import time
import zipfile

import duckdb
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

try:
    from .archive_tls import VERIFY
except ImportError:
    from archive_tls import VERIFY

try:
    from .ingest_jobs import ingest
    from .role_scope import is_candidate, ROOT
except ImportError:
    from ingest_jobs import ingest
    from role_scope import is_candidate, ROOT

BASE = 'https://data.arbetsformedlingen.se/annonser/historiska'


def download(year, directory, on_checkpoint=None):
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f'{year}.jsonl.zip'
    url = f'{BASE}/{target.name}'
    if target.exists() and zipfile.is_zipfile(target):
        print(f'Using cached {target}', flush=True)
        return target, url
    partial = target.with_suffix('.zip.part')
    with requests.Session() as session:
        session.mount('https://', HTTPAdapter(max_retries=Retry(total=4, backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504])))
        offset = partial.stat().st_size if partial.exists() else 0
        headers = {'Range': f'bytes={offset}-'} if offset else {}
        with session.get(url, headers=headers, stream=True, timeout=(30, 120), verify=VERIFY) as response:
            response.raise_for_status()
            if response.status_code != 206:
                offset = 0
            expected = int(response.headers.get('Content-Length', 0)) + offset
            size = offset
            reported = time.monotonic()
            with partial.open('ab' if offset else 'wb') as out:
                for chunk in response.iter_content(1024 * 1024):
                    out.write(chunk)
                    size += len(chunk)
                    if time.monotonic() - reported > 15:
                        if on_checkpoint:
                            on_checkpoint()
                        print(f'{year}: downloaded {size / 1e6:.0f} MB / {expected / 1e6:.0f} MB', flush=True)
                        reported = time.monotonic()
            if expected and size != expected:
                raise ValueError('Incomplete download')
    if not zipfile.is_zipfile(partial):
        raise ValueError('Download is not a ZIP archive')
    partial.replace(target)
    return target, url


def archive_months(name):
    """The first day of each month an archive covers: '2025' -> 12 months, '2026-Q2' -> April to June."""
    year = int(str(name)[:4])
    quarter = int(str(name)[-1]) if '-Q' in str(name) else None
    months = range(3 * quarter - 2, 3 * quarter + 1) if quarter else range(1, 13)
    return [date(year, m, 1) for m in months]


def import_archive(path, name, database, source_uri=None, batch_size=500):
    started = time.monotonic()
    months = archive_months(name)
    scope_hash = hashlib.sha256((ROOT / 'seeds/role_patterns.csv').read_bytes()).hexdigest()
    with path.open('rb') as handle:
        checksum = hashlib.file_digest(handle, 'sha256').hexdigest()
    ingest([], database, 'historical')
    # Mark every month incomplete before writing. Failed/restarted imports must not publish zeros.
    with duckdb.connect(str(database)) as con:
        for month in months:
            con.execute('''insert or replace into raw.collection_coverage values
                (?, ?, ?, 0, 0, null, 'loading', ?)''',
                [month, source_uri or str(path), checksum, scope_hash])
    counts, candidates = Counter(), Counter()
    batch, added, rows, outside_year = [], 0, 0, 0
    with zipfile.ZipFile(path) as archive:
        members = [n for n in archive.namelist() if n.endswith(('.jsonl', '.ndjson', '.json')) and not n.endswith('/')]
        if not members:
            raise ValueError('No JSONL member in archive')
        for member in members:
            with archive.open(member) as lines:
                for line in lines:
                    if not line.strip():
                        continue
                    ad = json.loads(line)
                    if not isinstance(ad, dict):
                        raise ValueError('Expected one JSON object per line')
                    published = date.fromisoformat(ad['publication_date'][:10])
                    rows += 1
                    if published.replace(day=1) not in months:
                        # Preserve spillover candidates: a 2024 ad can occur in the 2025 file.
                        # Its publication date determines analysis membership, never the filename.
                        outside_year += 1
                    key = published.replace(day=1)
                    counts[key] += 1
                    if is_candidate(ad):
                        candidates[key] += 1
                        batch.append(ad)
                    if len(batch) >= batch_size:
                        added += ingest(batch, database, 'historical')
                        batch.clear()
                    if rows % 100000 == 0:
                        print(f'{name}: scanned {rows:,} rows; retained {sum(candidates.values()):,}', flush=True)
    if batch:
        added += ingest(batch, database, 'historical')
    if not rows:
        raise ValueError('Archive contains no ads')
    # Reading to EOF checks ZIP member CRC. Coverage is committed only after the entire archive succeeds.
    with duckdb.connect(str(database)) as con:
        con.execute('begin')
        for key in months:
            con.execute('''update raw.collection_coverage set source_rows=?, candidate_rows=?,
                completed_at=current_timestamp, status='complete' where publication_month=?''',
                [counts[key], candidates[key], key])
        con.execute('commit')
    result = {'archive': str(name), 'source_rows': rows, 'outside_archive_months': outside_year,
              'candidate_rows': sum(candidates.values()),
              'new_versions': added, 'seconds': round(time.monotonic() - started, 2),
              'source_uri': source_uri or str(path), 'sha256': checksum, 'scope_version': scope_hash}
    print(json.dumps(result), flush=True)
    return result


def month_end(month):
    return (month + timedelta(days=32)).replace(day=1) - timedelta(days=1)


def import_stream(database, after, raw_root, batch_size=500):
    """Candidates published after `after` (the last archive day) from the JobStream answers that
    ingest_stream.py stored under raw_root/jobtech/stream/raw, oldest first so the latest version
    of an ad wins, up to the stream's last complete day. A month is complete when the stream covers
    every day of it (manifest_stream.json); otherwise it is 'partial', never compared. Returns None,
    and writes nothing, when no stream is stored."""
    manifest_path = raw_root / 'jobtech/market/manifest_stream.json'
    files = sorted((raw_root / 'jobtech/stream/raw').glob('*.json.gz'))
    if not manifest_path.exists() or not files:
        print(f'No stored stream under {raw_root}: nothing after {after} is imported', flush=True)
        return None
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    complete_from = date.fromisoformat(manifest['complete_from'])
    last = date.fromisoformat(manifest['last_complete_day'])
    started = time.monotonic()
    ingest([], database, 'historical')
    seen, candidates, batch, added = {}, set(), [], 0
    for path in files:
        for ad in json.loads(gzip.decompress(path.read_bytes())):
            if ad.get('removed') or not ad.get('publication_date'):
                continue  # a removal comes without its publication date; the earlier version stays
            published = date.fromisoformat(ad['publication_date'][:10])
            if not after < published <= last:
                continue
            seen[str(ad['id'])] = published.replace(day=1)
            if is_candidate(ad):
                candidates.add(str(ad['id']))
                batch.append(ad)
            if len(batch) >= batch_size:
                added += ingest(batch, database, 'historical')
                batch.clear()
    if batch:
        added += ingest(batch, database, 'historical')
    scope_hash = hashlib.sha256((ROOT / 'seeds/role_patterns.csv').read_bytes()).hexdigest()
    rows, kept = Counter(seen.values()), Counter(seen[i] for i in candidates)
    source = f'https://jobstream.api.jobtechdev.se/stream {complete_from} to {last}'
    month, months = (after + timedelta(days=1)).replace(day=1), []
    with duckdb.connect(str(database)) as con:
        while month <= last:
            status = 'complete' if complete_from <= month and month_end(month) <= last else 'partial'
            con.execute('''insert or replace into raw.collection_coverage values
                (?, ?, ?, ?, ?, current_timestamp, ?, ?)''',
                [month, source, manifest.get('sha256'), rows[month], kept[month], status, scope_hash])
            months.append(f'{month:%Y-%m} {status}')
            month = month_end(month) + timedelta(days=1)
    result = {'archive': 'stream', 'answers': len(files), 'ads': len(seen), 'candidate_rows': len(candidates),
              'new_versions': added, 'months': months, 'seconds': round(time.monotonic() - started, 2)}
    print(json.dumps(result), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--years', nargs='+', default=['2024', '2025'], help="Archives: '2025', '2026-Q1' ...")
    parser.add_argument('--stream', action='store_true',
                        help='Also import the stored JobStream answers after the last archive')
    parser.add_argument('--database', default='data/history.duckdb')
    parser.add_argument('--directory', type=Path, default=Path('data/history_archives'))
    parser.add_argument('--archive', type=Path, help='Local archive; requires one year')
    parser.add_argument('--all-occupations', action='store_true', help='Retain full text for every occupation in checkpointed Parquet shards; no role filters')
    parser.add_argument('--corpus-output', type=Path, default=Path('warehouse/raw/jobtech/cluster-corpus'))
    args = parser.parse_args()
    if args.archive and len(args.years) != 1:
        parser.error('--archive requires exactly one year')
    results = []
    for year in args.years:
        path, uri = (args.archive, str(args.archive)) if args.archive else download(year, args.directory)
        if args.all_occupations:
            try:
                from .full_corpus import import_archive_all
            except ImportError:
                from full_corpus import import_archive_all
            results.append(import_archive_all(path, str(year), args.corpus_output, uri))
        else:
            results.append(import_archive(path, year, args.database, uri))
    if args.stream:
        from portfolio.storage.rawstore import RAW
        after = max(month_end(m) for name in args.years for m in archive_months(name))
        if stream := import_stream(args.database, after, RAW):
            results.append(stream)
    args.directory.mkdir(parents=True, exist_ok=True)
    (args.directory / 'last_import.json').write_text(json.dumps(results, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
