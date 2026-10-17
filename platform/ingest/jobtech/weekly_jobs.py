"""Current Data/IT ads through the existing JobSearch client and immutable raw.job_ads writer."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
sys.path.insert(0,str(Path(__file__).resolve().parent))

from ingest_jobs import API, fetch_search, ingest, jobsearch_session  # noqa: E402
from compliance_intelligence.sources import new_output, now, seal, store_document, write_json  # noqa: E402
from lib.rawstore import sha256  # noqa: E402

IT_FIELD = 'apaJ_2ja_LuF'  # Existing market.json taxonomy: Data/IT.
LOCAL = ZoneInfo('Europe/Stockholm')


def collect(output, database, *, as_of=None, days=7, http=None):
    end = (as_of or datetime.now(LOCAL)).astimezone(LOCAL).replace(tzinfo=None,microsecond=0)
    start = end-timedelta(days=days)
    if not 1 <= days <= 31:
        raise ValueError('Weekly collection window must be 1..31 days')
    client = http or jobsearch_session()
    try:
        with new_output(output) as stage:
            documents, observations, all_ads = [], [], []
            def observe(response, params):
                store_document(stage,documents,response.content,source_url=API,publisher='Arbetsförmedlingen JobTech',
                    source_id='jobtech_jobsearch',fetched_at=now(),content_type='application/json',request_params=params)
            def window(lo,hi,depth=0):
                params={'occupation-field':IT_FIELD,'published-after':lo.isoformat(),
                    'published-before':hi.isoformat(),'sort':'pubdate-desc'}
                ads, coverage = fetch_search(client,params,20,observe=observe,allow_window_split=True)
                observations.append({'parameters':params,**coverage})
                if coverage['requires_window_split']:
                    if depth >= 10 or hi-lo <= timedelta(seconds=4):
                        raise ValueError('JobSearch dense time window exceeds the permitted offset range')
                    middle=(lo+(hi-lo)/2).replace(microsecond=0)
                    window(lo,middle+timedelta(seconds=1),depth+1)
                    window(middle-timedelta(seconds=1),hi,depth+1)
                else:
                    if not coverage['complete']:
                        raise ValueError('JobSearch changed during pagination; retry the reproducible window')
                    all_ads.extend(ads)
            window(start,end)
            unique = list({str(a['id']):a for a in all_ads}.values())
            ads, excluded = [], []
            for ad in unique:
                field=ad.get('occupation_field') or {}
                if (not isinstance(field,dict) or field.get('concept_id') != IT_FIELD or ad.get('removed') is True):
                    excluded.append({'job_id':str(ad['id']),'reason':'removed_or_unconfirmed_IT_field'})
                else:
                    ads.append(ad)
            versions=[]
            for ad in ads:
                text=json.dumps(ad,sort_keys=True,ensure_ascii=False)
                versions.append({'job_id':str(ad['id']),'payload_hash':sha256(text.encode('utf-8'))})
            ingest(ads,database,'live')
            manifest={'schema_version':1,'source_url':API,'source_id':'jobtech_jobsearch',
                'license_url':'https://creativecommons.org/publicdomain/zero/1.0/deed.sv',
                'occupation_field_id':IT_FIELD,'occupation_field':'Data/IT',
                'window_start':start.isoformat(),'window_end':end.isoformat(),'query_timezone':'Europe/Stockholm',
                'collected_at':now(),'observed_active_ads':len(ads),'duplicate_observations':len(all_ads)-len(unique),
                'excluded_observations':excluded,
                'observations':observations,'versions':sorted(versions,key=lambda r:r['job_id']),
                'coverage_status':'complete_search_at_observation',
                'limitations':['Active JobTech ads published inside this window only; not all Swedish vacancies.',
                    'Live API has no snapshot token; unchanged page totals cannot prove immutable source contents.',
                    'Query wall times are generated in Europe/Stockholm; upstream offset semantics are not specified by OpenAPI. Publication timestamps retain their source representation.',
                    'Advertisements and requested vacancies are not hires.',
                    f'{len(excluded)} returned records were excluded: removed or without the exact Data/IT field.']}
            write_json(stage/'collection.json',manifest)
            seal(stage)
        return manifest
    finally:
        if http is None:
            client.close()
