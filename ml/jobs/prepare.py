from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROLES = ('Data Engineer', 'Analytics Engineer', 'Data Scientist', 'Software Developer')
TEXT_VERSION = 'title-description-skills-v1'


def normalise(value) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def semantic_text(title, description, skills) -> str:
    # Metadata such as region, year and hand-built role is deliberately excluded.
    return f'TITLE: {normalise(title)}\nDESCRIPTION: {normalise(description)}\nSKILLS: ' + ', '.join(sorted(set(map(normalise, skills))))


def text_hash(text: str) -> str:
    return hashlib.sha256((TEXT_VERSION + '\n' + text).encode('utf-8')).hexdigest()


def load_jobs(database: Path, limit: int | None = None):
    import duckdb
    import pandas as pd

    if not database.is_file():
        raise FileNotFoundError(f'Job warehouse missing: {database}. Run the existing historical ingestion and dbt jobs build first.')
    with duckdb.connect(str(database), read_only=True) as con:
        jobs = con.execute('''select job_id, title, description, required_skills,
            role_family, seniority, occupation, region, published_at, employment_type, source_kind
            from silver.int_job_ads_enriched where role_family in (?, ?, ?, ?)
            and length(trim(description)) > 0 order by job_id''', ROLES).df()
        skills = con.execute('select job_id, skill from gold.bridge_job_skills order by job_id, skill').df()
    if jobs.job_id.duplicated().any():
        raise ValueError('Duplicate job_id in analysis source')
    if 'fixture' in set(jobs.source_kind):
        raise ValueError('Fixture advertisements cannot be used for published analysis')
    total = len(jobs)
    # Stable hash sample; no preferential selection of the first year/title.
    if limit and total > limit:
        jobs = jobs.assign(sample_key=jobs.job_id.map(lambda x: hashlib.sha256(str(x).encode()).hexdigest())).sort_values('sample_key').head(limit).drop(columns='sample_key').sort_values('job_id')
    by_id = skills.groupby('job_id').skill.apply(list).to_dict()
    def source_skills(value):
        parsed = json.loads(value) if isinstance(value, str) else value
        return [v.get('label', '') if isinstance(v, dict) else str(v) for v in (parsed or [])]
    jobs['skills'] = jobs.job_id.map(lambda jid: by_id.get(jid, []))
    jobs['text'] = [semantic_text(r.title, r.description, r.skills + source_skills(r.required_skills)) for r in jobs.itertuples()]
    jobs['text_hash'] = jobs.text.map(text_hash)
    jobs['published_year'] = pd.to_datetime(jobs.published_at).dt.year.astype(int)
    if len(jobs) < 20:
        raise ValueError('At least 20 nonempty selected advertisements are required')
    return jobs.reset_index(drop=True), total
