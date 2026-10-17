"""Private Bronze acquisition, Silver extraction and Gold coverage CLI for Phase 2."""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import uuid
from collections import deque
from pathlib import Path

import duckdb
from pypdf.errors import PyPdfError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import load_env  # noqa: E402
from compliance_intelligence.authority_http import AccessFailure, AuthorityHttp  # noqa: E402
from compliance_intelligence.authority_sources import (  # noqa: E402
    EXTRACTION_VERSION, SOURCES, ExtractionFailure, extract, official_url, source_spec,
)
from compliance_intelligence.cohort import verify_cohort  # noqa: E402
from compliance_intelligence.registry import encoded, relative_file, resolve, reviewed  # noqa: E402
from compliance_intelligence.sources import load_snapshot, now, private_path, write_json  # noqa: E402
from lib.rawstore import sha256  # noqa: E402

LOG = logging.getLogger(__name__)


class Store:
    def __init__(self, root):
        self.root = private_path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.connection = duckdb.connect(str(relative_file(self.root, "ingestion.duckdb")))
        self.connection.execute(Path(__file__).with_name("ingestion.sql").read_text(encoding="utf-8"))

    def close(self):
        self.connection.close()

    def execute(self, sql, parameters=None):
        return self.connection.execute(sql, parameters or [])

    def extraction(self, document_id):
        row = self.execute("select payload from silver.document_extraction where document_id=? and extraction_version=?",
                           [document_id, EXTRACTION_VERSION]).fetchone()
        return json.loads(row[0]) if row else None

    def current(self, source, url):
        row = self.execute("""select r.document_id, r.etag, r.last_modified, d.document_hash
            from bronze.resource r join bronze.document_version d using(document_id)
            where r.source_id=? and r.source_url=?""", [source, url]).fetchone()
        return row

    def accept(self, source, url, headers, body, copy_review=None):
        digest = sha256(body)
        document_id = sha256(encoded([source, url, digest]))
        previous = self.current(source, url)
        storage_ref = None
        if copy_review:
            storage_ref = "bronze/blobs/" + digest + ".bin"
            path = relative_file(self.root, storage_ref)
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.exists():
                if sha256(path.read_bytes()) != digest:
                    raise ValueError("Stored document hash mismatch")
            else:
                with path.open("xb") as stream:
                    stream.write(body)
        self.execute("""insert into bronze.document_version
            (document_id,source_id,authority,source_url,document_hash,content_type,byte_count,
             first_fetched_at,storage_ref,reuse_status,copy_review)
            values (?,?,?,?,?,?,?,?,?,?,?) on conflict(document_id) do update set
            storage_ref=coalesce(document_version.storage_ref, excluded.storage_ref),
            copy_review=coalesce(document_version.copy_review, excluded.copy_review),
            reuse_status=case when coalesce(document_version.storage_ref, excluded.storage_ref) is not null
                then 'private_copy_reviewed' else document_version.reuse_status end""",
            [document_id, source, source_spec(source)["authority"], url, digest,
             headers.get("content-type", "application/octet-stream"), len(body), now(), storage_ref,
             "private_copy_reviewed" if copy_review else "reference_only_unverified",
             json.dumps(copy_review) if copy_review else None])
        self.execute("""insert into bronze.resource values (?,?,?,?,?,?) on conflict(source_id,source_url)
            do update set document_id=excluded.document_id, etag=excluded.etag,
            last_modified=excluded.last_modified,last_verified_at=excluded.last_verified_at""",
            [source, url, document_id, headers.get("etag"), headers.get("last-modified"), now()])
        return document_id, previous[0] if previous else None

    def save_extraction(self, document_id, payload, extraction_version=EXTRACTION_VERSION):
        self.execute("""insert into silver.document_extraction
            (document_id,extraction_version,extracted_at,publication_date,decision_date,case_reference,payload)
            values (?,?,?,?,?,?,?) on conflict do nothing""",
            [document_id, extraction_version, now(), payload["publication_date"], payload["decision_date"],
             payload["case_reference"], json.dumps(payload, ensure_ascii=False)])

    def discover(self, run_id, source, link, parent=""):
        self.execute("insert into silver.discovery values (?,?,?,?,?,?,?) on conflict do nothing",
                     [run_id, source, link["url"], link["kind"], parent, link.get("label"), "pending"])

    def discovery_status(self, run_id, source, url, kind, status, *, pending_only=False):
        self.execute("update silver.discovery set status=? where run_id=? and source_id=? and source_url=? and kind=?"
                     + (" and status='pending'" if pending_only else ""),
                     [status, run_id, source, url, kind])


def copy_permission(policy, source, url):
    """A review grants private retention only for explicitly documented URL prefixes."""
    if not policy:
        return None
    entry = policy.get(source)
    if not entry:
        return None
    reviewed(entry)
    if entry.get("terms_url") != SOURCES[source]["terms"] or not entry.get("rationale"):
        raise ValueError("Copy review requires current source terms and rationale")
    for prefix in entry.get("allowed_prefixes", []):
        if not prefix.endswith("/"):
            raise ValueError("Copy-review prefixes must end in / to bound their path scope")
        prefix = official_url(source, prefix)
        if url.startswith(prefix):
            return entry
    return None


def company_mentions(payload, snapshot):
    # Name and number mentions are deliberately not paired by text proximity.
    mentions = []
    for field, arg in (("organization_numbers", "number"), ("named_legal_entities", "name")):
        for m in payload[field]:
            value = m["organization_number"] if arg == "number" else m["name"]
            if snapshot:
                match = resolve(snapshot, **{arg: value}, on_date=payload["decision_date"])
                # With no document date the registry's current date is only a search hint.
                if payload["decision_date"] is None:
                    match["company_id"] = None
                    match["status"] = "unverified"
                    match["reasons"].append("document_effective_date_unknown")
            else:
                match = {"status": "not_measured", "company_id": None, "candidate_ids": [],
                         "reasons": ["registry_not_supplied"]}
            mentions.append({**match, "mention": m, "subject_role": "contextual_mention",
                             "attribution_scope": "context_only", "review_status": "unreviewed"})
    return mentions


def ingest(root, *, sources=("imy", "kkv"), max_pages=1, max_records=2, max_documents=2,
           cohort=None, copy_policy=None, batch_manifest=None, http_factory=AuthorityHttp):
    if not sources or len(set(sources)) != len(sources) or any(s not in SOURCES for s in sources):
        raise ValueError("Choose distinct supported sources")
    if not all(type(n) is int and 1 <= n <= 10000 for n in (max_pages, max_records, max_documents)):
        raise ValueError("Each batch bound must be between 1 and 10000")
    cohort_info, snapshot, members = None, None, []
    if cohort:
        cohort_info = verify_cohort(cohort)
        snapshot = load_snapshot(cohort)
        members = json.loads((Path(cohort) / "cohort.json").read_text(encoding="utf-8"))
    policy = json.loads(Path(copy_policy).read_text(encoding="utf-8")) if copy_policy else None
    pinned = None
    if batch_manifest:
        manifest = json.loads(Path(batch_manifest).read_text(encoding="utf-8"))
        if manifest.get("schema_version") != 1 or not manifest.get("resources"):
            raise ValueError("Batch manifest requires schema_version 1 and resources")
        pinned = {s: {} for s in sources}
        for item in manifest["resources"]:
            source = item["source_id"]
            if source not in SOURCES or item["kind"] not in ("listing", "record", "document"):
                raise ValueError("Unsupported manifest source or resource kind")
            url = official_url(source, item["source_url"])
            digest = item.get("document_hash")
            if digest is not None and (len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest)):
                raise ValueError("Invalid manifest baseline hash")
            if source in sources:
                key = (url, item["kind"])
                if key in pinned[source]:
                    raise ValueError("Duplicate manifest resource")
                pinned[source][key] = digest
        if any(not items for items in pinned.values()):
            raise ValueError("Each requested source must have manifest resources")
    if policy is not None:
        for source in sources:
            copy_permission(policy, source, SOURCES[source]["seed"])
    store = Store(root)
    run_id = str(uuid.uuid4())
    configuration = {"sources": list(sources), "max_pages": max_pages, "max_records": max_records,
                     "max_documents": max_documents, "extraction_version": EXTRACTION_VERSION,
                     "ingestion_code_sha256": sha256(encoded({name: sha256(Path(__file__).with_name(name).read_bytes())
                         for name in ("decision_ingest.py", "authority_http.py", "authority_sources.py", "ingestion.sql")})),
                     "cohort": cohort_info, "seeds": {s: SOURCES[s]["seed"] for s in sources},
                     "copy_policy_sha256": sha256(encoded(policy)) if policy else None}
    configuration["batch_manifest_sha256"] = sha256(Path(batch_manifest).read_bytes()) if batch_manifest else None
    report = {"schema_version": 1, "run_id": run_id, "started_at": now(), "configuration": configuration,
              "sources": {}, "cohort_status": "not_measured_registry_missing" if not cohort else "candidate_scan_only",
              "cohort_size": len(members) if cohort else None, "interpretation": "not_performed",
              "publication_status": "not_approved", "limitations": [
                  "Published source selections are not complete authority registers",
                  "No absence-of-violation inference; no appeal/finality or liability determination",
                  "Reference-only responses cannot be replayed offline; exact-byte hashes allow later verification"]}
    try:
        store.execute("insert into bronze.ingestion_run (run_id,started_at,configuration) values (?,?,?)",
                      [run_id, report["started_at"], json.dumps(configuration)])
        for source in sources:
            stats = {"authority": SOURCES[source]["authority"], "scope": SOURCES[source]["scope"],
                     "terms_url": SOURCES[source]["terms"], "status": "running", "pages": 0, "records": 0,
                     "documents": 0, "unchanged": 0, "changed_versions": 0, "failures": [],
                     "limitations": [], "observations": [], "terminal_listing_reached": False}
            report["sources"][source] = stats
            last_attempt = [None]

            def attempt(url, status, number, metadata, error):
                fetch_id = str(uuid.uuid4())
                last_attempt[0] = fetch_id
                store.execute("""insert into bronze.fetch
                    (fetch_id,run_id,source_id,source_url,fetched_at,status_code,attempt,response_metadata,error_code)
                    values (?,?,?,?,?,?,?,?,?)""",
                    [fetch_id, run_id, source, url, now(), status, number, json.dumps(metadata), error])

            def robots(url, status, digest, rules):
                store.execute("insert into bronze.robots_observation values (?,?,?,?,?,?,?)",
                              [run_id, source, url, now(), digest, status, json.dumps(rules)])

            http = http_factory(source, attempt, robots)
            queue = deque([{"url": url, "kind": kind} for url, kind in pinned[source]] if pinned is not None
                          else [{"url": SOURCES[source]["seed"], "kind": "listing"}])
            for item in queue:
                store.discover(run_id, source, item)
            visited = set()
            try:
                while queue:
                    item = queue.popleft()
                    url, kind = official_url(source, item["url"]), item["kind"]
                    if (url, kind) in visited:
                        store.discovery_status(run_id, source, url, kind, "duplicate_discovery", pending_only=True)
                        continue
                    visited.add((url, kind))
                    counter = {"listing": "pages", "record": "records", "document": "documents"}[kind]
                    limit = {"listing": max_pages, "record": max_records, "document": max_documents}[kind]
                    if stats[counter] >= limit:
                        store.discovery_status(run_id, source, url, kind, "deferred_batch_limit")
                        continue
                    stats[counter] += 1
                    document_id = None
                    try:
                        current = store.current(source, url)
                        validators = {}
                        if current and store.extraction(current[0]):
                            if current[1]:
                                validators["If-None-Match"] = current[1]
                            if current[2]:
                                validators["If-Modified-Since"] = current[2]
                        final_url, status, headers, content = http.get(url, validators)
                        old = store.current(source, final_url)
                        if status == 304:
                            if not old or not store.extraction(old[0]):
                                raise AccessFailure("304_without_cached_extraction")
                            document_id, previous = old[0], old[0]
                            store.execute("update bronze.resource set last_verified_at=? where source_id=? and source_url=?",
                                          [now(), source, final_url])
                        else:
                            document_id, previous = store.accept(source, final_url, headers, content,
                                copy_permission(policy, source, final_url))
                        changed = previous is not None and previous != document_id
                        stats["changed_versions"] += int(changed)
                        stats["unchanged"] += int(previous == document_id)
                        store.execute("""update bronze.fetch set document_id=?,previous_document_id=?,changed=?
                            where fetch_id=?""", [document_id, previous, changed, last_attempt[0]])
                        payload = store.extraction(document_id)
                        if payload is None:
                            payload = extract(source, final_url, content, headers.get("content-type", ""), kind)
                            store.save_extraction(document_id, payload)
                        stats["limitations"].extend(payload["limitations"])
                        if payload["kind"] != kind:
                            raise AccessFailure("resource_kind_conflict_requires_review")
                        if kind == "listing":
                            # A terminal page is still just the end of a selected public list.
                            stats["terminal_listing_reached"] = not any(l["kind"] == "listing" for l in payload["links"])
                        for link in payload["links"]:
                            store.discover(run_id, source, link, document_id)
                            if pinned is None or (link["url"], link["kind"]) in pinned[source]:
                                queue.append(link)
                            else:
                                store.discovery_status(run_id, source, link["url"], link["kind"], "deferred_manifest_scope")
                        if kind != "listing":
                            for i, mention in enumerate(company_mentions(payload, snapshot)):
                                store.execute("""insert into silver.company_mention
                                    (run_id,document_id,mention_index,company_id,candidate_ids,resolution)
                                    values (?,?,?,?,?,?) on conflict do nothing""", [run_id, document_id, i,
                                    mention["company_id"], json.dumps(mention["candidate_ids"]), json.dumps(mention, ensure_ascii=False)])
                        stats["observations"].append({"requested_url": url, "source_url": final_url,
                            "kind": kind, "document_id": document_id,
                            "document_hash": store.current(source, final_url)[3],
                            "publication_date": payload["publication_date"], "decision_date": payload["decision_date"],
                            "review_status": "unreviewed", "revision_marker_count": len(payload["revision_markers"]),
                            "change_status": "bytes_changed_requires_review" if changed else "no_new_byte_version"})
                        if pinned is not None:
                            baseline = pinned[source][url, kind]
                            stats["observations"][-1].update(baseline_document_hash=baseline,
                                baseline_hash_matches=(store.current(source, final_url)[3] == baseline) if baseline else None)
                        store.discovery_status(run_id, source, url, kind, "observed")
                        LOG.info("source=%s kind=%s document=%s changed=%s", source, kind, document_id, changed)
                    except (AccessFailure, ValueError, OSError, PyPdfError) as exc:
                        # Errors contain codes/types, never document text or personal data.
                        code = exc.code if isinstance(exc, (AccessFailure, ExtractionFailure)) else "extraction_" + type(exc).__name__
                        stats["failures"].append({"source_url": url, "kind": kind, "error_code": code,
                                                  "document_id": document_id})
                        store.discovery_status(run_id, source, url, kind, "failed:" + code)
                        if isinstance(exc, AccessFailure) and exc.halt:
                            stats["status"] = "blocked_access"
                            break
            finally:
                http.close()
            store.execute("""update silver.discovery set status='deferred_source_halted'
                where run_id=? and source_id=? and status='pending'""", [run_id, source])
            pending = store.execute("""select status,count(*) from silver.discovery where run_id=? and source_id=?
                group by status""", [run_id, source]).fetchall()
            stats["discovery_counts"] = dict(pending)
            stats["limitations"] = sorted(set(stats["limitations"]))
            if stats["status"] != "blocked_access":
                stats["status"] = "partial_failures" if stats["failures"] else (
                    "bounded_partial" if any(k.startswith("deferred") for k in stats["discovery_counts"])
                    or stats["limitations"] else ("manifest_batch_completed" if pinned is not None else "published_list_traversed"))
            stats["coverage_fraction"] = None
        report["finished_at"] = now()
        report["cohort_observations"] = []
        if members:
            rows = store.execute("select document_id,candidate_ids from silver.company_mention where run_id=?", [run_id]).fetchall()
            for member in members:
                candidates = sorted({d for d, ids in rows if member["company_id"] in json.loads(ids)})
                report["cohort_observations"].append({"company_id": member["company_id"],
                    "candidate_document_ids": candidates, "search_status": "partial_publication_scan",
                    "coverage_fraction": None, "relationship_expansion": False})
        store.execute("update bronze.ingestion_run set finished_at=?,report=? where run_id=?",
                      [report["finished_at"], json.dumps(report, ensure_ascii=False), run_id])
        destination = relative_file(store.root, "gold/runs/" + run_id)
        destination.mkdir(parents=True)
        write_json(destination / "coverage.json", report)
        # Match existing analytical delivery formats, but keep this export private.
        import pyarrow as pa
        import pyarrow.parquet as pq
        table = pa.Table.from_pylist([{"run_id": run_id, "source_id": s, "status": r["status"],
            "pages_attempted": r["pages"], "records_attempted": r["records"], "documents_attempted": r["documents"],
            "observed_resources": len(r["observations"]), "failures": len(r["failures"]),
            "cohort_size": report["cohort_size"], "coverage_fraction": r["coverage_fraction"]}
            for s, r in report["sources"].items()])
        pq.write_table(table, destination / "coverage.parquet")
        report["report_path"] = str(destination / "coverage.json")
        return report
    finally:
        store.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", choices=("imy", "kkv", "all"), default="all")
    parser.add_argument("--root", type=Path)
    parser.add_argument("--cohort", type=Path, help="Verified frozen Phase 1 bundle; never edited")
    parser.add_argument("--copy-policy", type=Path, help="Private retention review JSON; default: stable references")
    parser.add_argument("--batch-manifest", type=Path, help="Pin source URLs and compare baseline hashes; no scope expansion")
    parser.add_argument("--max-pages", type=int, default=1)
    parser.add_argument("--max-records", type=int, default=2)
    parser.add_argument("--max-documents", type=int, default=2)
    parser.add_argument("--log-level", choices=("INFO", "WARNING", "ERROR"), default="INFO")
    args = parser.parse_args(argv)
    load_env()
    logging.basicConfig(level=args.log_level, format="%(levelname)s %(message)s")
    try:
        report = ingest(args.root or Path(os.environ.get("COMPLIANCE_PRIVATE_ROOT", ".research/compliance-intelligence")) / "decisions",
            sources=("imy", "kkv") if args.source == "all" else (args.source,), max_pages=args.max_pages,
            max_records=args.max_records, max_documents=args.max_documents, cohort=args.cohort,
            copy_policy=args.copy_policy, batch_manifest=args.batch_manifest)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if any(r["failures"] for r in report["sources"].values()) else 0
    except (ValueError, OSError, KeyError, TypeError, duckdb.Error) as exc:
        LOG.error("Phase 2 could not finish: %s", type(exc).__name__)
        return 2


if __name__ == "__main__":
    sys.exit(main())
