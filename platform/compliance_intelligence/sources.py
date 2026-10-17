"""SCB AFR v1 and local register snapshots. All output stays in a private directory."""
from __future__ import annotations

import csv
import io
import json
import os
import tempfile
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import requests

from lib.rawstore import session, sha256
from compliance_intelligence.registry import (
    POLICY, encoded, https_url, normalize_snapshot, organization_number, relative_file, reviewed, utc_timestamp,
)

ROOT = Path(__file__).resolve().parents[2]
SCB_BASE = "https://apiafr.scb.se/v1"
SCB_TERMS = "https://www.scb.se/vara-tjanster/bestall-data-och-statistik/foretagsregistret/avgiftsfria-uppgifter-i-foretagsregistret/"


def now():
    return datetime.now(timezone.utc).isoformat()


def private_path(path) -> Path:
    path = Path(path).resolve()
    forbidden = [ROOT / p for p in ("warehouse", "frontend", "dist", ".git", "node_modules", "platform")]
    if path == ROOT or any(path.is_relative_to(p.resolve()) for p in forbidden):
        raise ValueError("Compliance output must be outside public, warehouse and source-code roots")
    if path.is_relative_to(ROOT) and not any(path.is_relative_to(ROOT / p) for p in (".research", "tmp")):
        raise ValueError("Inside this repository use .research/ or tmp/ for private compliance data")
    for variable in ("PORTFOLIO_RAW", "PORTFOLIO_FEATURES"):
        if os.environ.get(variable) and path.is_relative_to(Path(os.environ[variable]).resolve()):
            raise ValueError("Compliance output overlaps a configured warehouse upload root")
    if os.environ.get("PORTFOLIO_DB") and Path(os.environ["PORTFOLIO_DB"]).resolve().is_relative_to(path):
        raise ValueError("Compliance output contains the configured public warehouse database")
    return path


@contextmanager
def new_output(path):
    """Create once, with no partial bundle exposed if validation fails."""
    output = private_path(path)
    if output.exists():
        raise ValueError("Output already exists; frozen snapshots and cohorts cannot be replaced")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".compliance-", dir=output.parent) as temporary:
        stage = Path(temporary).resolve()
        if stage.parent != output.parent:
            raise ValueError("Staging path escaped output parent")
        yield stage
        stage.rename(output)


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded(value))


def seal(directory: Path):
    files = {p.relative_to(directory).as_posix(): {"sha256": sha256(p.read_bytes()), "bytes": p.stat().st_size}
             for p in sorted(directory.rglob("*")) if p.is_file() and p != directory / "artifact-manifest.json"}
    write_json(directory / "artifact-manifest.json", {"schema_version": 1, "files": files})


def verify(directory) -> dict:
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "artifact-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or not manifest.get("files"):
        raise ValueError("Invalid bundle manifest")
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file()
              and p != directory / "artifact-manifest.json"}
    if actual != set(manifest["files"]):
        raise ValueError("Bundle has missing or unexpected files")
    for relative, evidence in manifest["files"].items():
        path = relative_file(directory, relative)
        if path.stat().st_size != evidence["bytes"] or sha256(path.read_bytes()) != evidence["sha256"]:
            raise ValueError("Bundle integrity check failed: " + relative)
    return manifest


def load_snapshot(directory):
    verify(directory)
    snapshot = json.loads((Path(directory) / "snapshot.json").read_text(encoding="utf-8"))
    if snapshot.get("schema_version") != 1:
        raise ValueError("Unsupported register snapshot version")
    for doc in snapshot["documents"]:
        if sha256(relative_file(Path(directory), doc["path"]).read_bytes()) != doc["document_hash"]:
            raise ValueError("Original source document hash mismatch")
    return snapshot


def store_document(stage, documents, content, *, source_url, publisher, source_id,
                   fetched_at, content_type, request_params=None):
    digest = sha256(content)
    relative = "evidence/" + digest + ".bin"
    target = stage / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    doc = {"document_id": f"doc-{len(documents)}-{digest[:16]}", "document_hash": digest,
           "path": relative, "source_url": https_url(source_url), "publisher": publisher,
           "source_id": source_id, "fetched_at": utc_timestamp(fetched_at),
           "content_type": content_type, "byte_count": len(content),
           "request_params": request_params or {}, "access_status": "unknown"}
    documents.append(doc)
    return doc


def ingest_local(source, metadata_file, output, *, identities_file=None):
    source = Path(source)
    meta = json.loads(Path(metadata_file).read_text(encoding="utf-8-sig"))
    if type(meta.get("schema_version")) is not int or meta["schema_version"] != 1:
        raise ValueError("Unsupported local provenance sidecar version")
    meta["acquisition_method"] = "local_extract"
    original = source.read_bytes()
    if str(meta.get("source_sha256", "")).lower() != sha256(original):
        raise ValueError("Local extract SHA-256 differs from its provenance sidecar")
    meta["source_sha256"] = sha256(original)
    for field in ("source_url", "source_id", "publisher", "as_of_date", "fetched_at", "sni_version"):
        if not meta.get(field):
            raise ValueError("Local metadata requires " + field)
    utc_timestamp(meta["fetched_at"])
    if source.suffix.lower() == ".csv":
        text = original.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), dialect=csv.Sniffer().sniff(text[:8192], delimiters=",;\t"))
        if not reader.fieldnames or len({name.lower() for name in reader.fieldnames}) != len(reader.fieldnames):
            raise ValueError("CSV headers must be present and unique")
        raw_rows = list(reader)
    elif source.suffix.lower() == ".parquet":
        import pyarrow.parquet as parquet
        table = parquet.read_table(io.BytesIO(original))
        if len(set(name.lower() for name in table.column_names)) != len(table.column_names):
            raise ValueError("Parquet headers must be unique")
        raw_rows = table.to_pylist()
    else:
        raise ValueError("Local extract must be CSV or Parquet")
    if type(meta.get("row_count")) is not int or meta["row_count"] != len(raw_rows):
        raise ValueError("Local extract row count differs from its sidecar")
    if not raw_rows:
        raise ValueError("Local register extract contains no rows")
    with new_output(output) as stage:
        documents = []
        doc = store_document(stage, documents, original, source_url=meta["source_url"],
            publisher=meta["publisher"], source_id=meta["source_id"], fetched_at=meta["fetched_at"],
            content_type="text/csv" if source.suffix.lower() == ".csv" else "application/vnd.apache.parquet")
        rows = []
        mapping = {"organization_number": "orgnr", "registered_legal_name": "namn",
                   "primary_sni_code": "primarnaringsgren.naringsgren", "active": "ftgstat",
                   "employee_size_class": "anstkl", "legal_form": "jurform"}
        for i, row in enumerate(raw_rows):
            if None in row:
                raise ValueError("Extract contains an unnamed extra column")
            row = {str(k).lower(): v for k, v in row.items()}
            normalized = dict(row)
            for field, scb_field in mapping.items():
                if field not in row and scb_field not in row:
                    raise ValueError("Local extract requires column " + field + " (or " + scb_field + ")")
                if field in row and scb_field in row and row[field] != row[scb_field]:
                    raise ValueError("Conflicting canonical and SCB columns for " + field)
                normalized[field] = row.get(field, row.get(scb_field))
            normalized.update(sni_version=row.get("sni_version", meta["sni_version"]),
                              source_document_id=doc["document_id"], source_locator=f"row:{i + 1}")
            normalized["review"] = meta.get("identity_review")
            rows.append(normalized)
        aliases, relationships = identity_supplement(identities_file, stage, documents, rows)
        snapshot = normalize_snapshot(rows, documents, meta, verified=reviewed(meta.get("identity_review")),
                                      aliases=aliases, relationships=relationships)
        write_json(stage / "snapshot.json", snapshot)
        write_json(stage / "population-manifest.json", meta)
        seal(stage)
    return snapshot


def identity_supplement(path, stage, documents, rows):
    if not path:
        return [], []
    path = Path(path)
    supplement = json.loads(path.read_text(encoding="utf-8-sig"))
    remap = {}
    for doc in supplement.get("documents", []):
        content = relative_file(path.parent, doc["path"]).read_bytes()
        if sha256(content) != doc["document_hash"]:
            raise ValueError("Identity evidence hash mismatch")
        stored = store_document(stage, documents, content, source_url=doc["source_url"],
            publisher=doc["publisher"], source_id=doc["source_id"], fetched_at=doc["fetched_at"],
            content_type=doc["content_type"])
        if doc["document_id"] in remap:
            raise ValueError("Duplicate identity evidence document ID")
        remap[doc["document_id"]] = stored["document_id"]
    for row in supplement.get("companies", []):
        if not reviewed(row.get("review")):
            raise ValueError("Additional identity requires a source review")
        row["source_document_id"] = remap[row["source_document_id"]]
        rows.append(row)
    for table in ("aliases", "relationships"):
        for row in supplement.get(table, []):
            row["source_document_id"] = remap[row["source_document_id"]]
    return supplement.get("aliases", []), supplement.get("relationships", [])


class ScbClient:
    """The documented AFR v1 cursor API, restricted to its official HTTPS origin."""

    def __init__(self, api_key=None, *, http=None, sleep=time.sleep, clock=now):
        self._key = api_key or os.environ.get("SCB_API_KEY")
        if not self._key or not self._key.strip():
            raise ValueError("SCB_API_KEY is missing; provide a local CSV/Parquet extract and metadata instead")
        self.http = http or session()
        self.sleep, self.clock = sleep, clock

    def get(self, path, params, stage, documents, *, allow_missing=False):
        self.sleep(0.25)  # Four requests/second; SCB permits five.
        url = SCB_BASE + path
        try:
            response = self.http.get(url, params=params, headers={"X-API-Key": self._key},
                                     timeout=60, allow_redirects=False)
        except requests.RequestException:
            raise ValueError("SCB request failed; no key or response body is logged") from None
        if response.status_code != 200 and not (allow_missing and response.status_code == 404):
            raise ValueError(f"SCB returned HTTP {response.status_code}; snapshot was not completed")
        doc = store_document(stage, documents, response.content, source_url=url,
            publisher="SCB", source_id="scb_company_register", fetched_at=self.clock(),
            content_type="application/json", request_params=params)
        body = json.loads(response.content)
        if not isinstance(body, dict):
            raise ValueError("SCB response must be a JSON object")
        doc["access_status"] = "restricted"
        if response.status_code == 404:
            return None, doc
        return body, doc

    def lookup(self, numbers, output, *, identities_file=None):
        """A register snapshot for requested legal persons; never an eligible-population sample."""
        requested = sorted({organization_number(n) for n in numbers})
        with new_output(output) as stage:
            documents, rows, missing = [], [], []
            for number in requested:
                # The production v1 endpoint requires SCB's 12-digit peOrgNr, not ten digits.
                item, doc = self.get('/juridiskaenheter/16'+number, {}, stage, documents, allow_missing=True)
                if item is None:
                    missing.append({'organization_number':number,'source_document_id':doc['document_id']})
                    continue
                if organization_number(item.get('orgNr','')) != number:
                    raise ValueError('SCB lookup returned a different organization number')
                primary = item.get('primarNaringsgren') or {}
                rows.append({'organization_number':number,'registered_legal_name':item.get('namn'),
                    'primary_sni_code':primary.get('naringsgren'),'sni_version':'2025',
                    'active':item.get('ftgStat'),'employee_size_class':item.get('anstKl'),
                    'legal_form':item.get('jurform'),'source_document_id':doc['document_id'],
                    'source_locator':'$'})
            metadata = {'schema_version':1,'source_id':'scb_company_register','publisher':'SCB',
                'source_url':SCB_BASE+'/juridiskaenheter','as_of_date':self.clock()[:10],
                'fetched_at':self.clock(),'sni_version':'2025','primary_sni_codes':[],
                'population_complete':False,'acquisition_method':'scb_api_lookup_v1',
                'requested_organization_numbers':requested,'not_found':missing,'terms_url':SCB_TERMS,
                'row_count':len(rows),'reuse_review':None,
                'limitations':'Current legal-entity lookup only; no historical or population-completeness claim'}
            aliases, relationships = identity_supplement(identities_file,stage,documents,rows)
            snapshot = normalize_snapshot(rows,documents,metadata,verified=True,aliases=aliases,relationships=relationships)
            # Unsupported/contradictory identities stay held with their original evidence.
            # A targeted lookup is not a complete population and must never claim to be one.
            write_json(stage/'snapshot.json',snapshot)
            write_json(stage/'population-manifest.json',metadata)
            seal(stage)
        return snapshot

    def ingest(self, output, *, page_size=5000, max_pages=1000, identities_file=None,
               reuse_review=None):
        if not 1 <= page_size <= 5000 or max_pages < 1:
            raise ValueError("SCB page size must be 1..5000 and max_pages positive")
        started_at = self.clock()
        with new_output(output) as stage:
            rows, documents, collections = [], [], []
            for code in POLICY["primary_sni_codes"]:
                path = "/juridiskaenheter/naringsgren/" + code
                before, _ = self.get(path + "/count", {}, stage, documents)
                expected = before.get("count")
                if type(expected) is not int or expected < 0:
                    raise ValueError("Invalid SCB count response")
                cursor, seen_cursors, identifiers, received = None, set(), set(), 0
                for page in range(max_pages):
                    params = {"limit": page_size}
                    if cursor is not None:
                        params["cursorId"] = cursor
                    body, doc = self.get(path, params, stage, documents)
                    data, pagination = body.get("jes"), body.get("pagination", {})
                    if not isinstance(data, list) or not isinstance(pagination, dict) or type(pagination.get("hasMore")) is not bool:
                        raise ValueError("Unexpected SCB JE/pagination response")
                    if pagination.get("limit") != page_size or len(data) > page_size:
                        raise ValueError("SCB changed the requested page size")
                    for i, item in enumerate(data):
                        if not isinstance(item, dict) or not all(isinstance(item.get(k), str) for k in ("orgNr", "namn", "ftgStat", "anstKl", "jurform")):
                            raise ValueError("SCB JE field types differ from the pinned v1 contract")
                        primary = item.get("primarNaringsgren") or {}
                        if not isinstance(primary, dict) or primary.get("naringsgren") != code or type(primary.get("rangordning")) is not int or primary["rangordning"] != 1:
                            raise ValueError("SCB returned a different primary industry")
                        identity = item["orgNr"]
                        if identity in identifiers:
                            raise ValueError("Repeated SCB identity across pages")
                        identifiers.add(identity)
                        rows.append({"organization_number": identity, "registered_legal_name": item["namn"],
                            "primary_sni_code": code, "sni_version": "2025", "active": item["ftgStat"],
                            "employee_size_class": item["anstKl"], "legal_form": item["jurform"],
                            "source_document_id": doc["document_id"], "source_locator": f"$.jes[{i}]"})
                    received += len(data)
                    if not pagination["hasMore"]:
                        break
                    cursor = pagination.get("nextCursorId")
                    if type(cursor) is not int or cursor in seen_cursors or not data:
                        raise ValueError("SCB cursor repeated or failed to advance")
                    seen_cursors.add(cursor)
                else:
                    raise ValueError("SCB page bound reached before terminal page")
                after, _ = self.get(path + "/count", {}, stage, documents)
                if received != expected or type(after.get("count")) is not int or after["count"] != expected:
                    raise ValueError("SCB population count changed or pagination is incomplete")
                collections.append({"primary_sni_code": code, "count_before": expected,
                    "count_after": after["count"], "received": received, "pages": page + 1,
                    "terminal_page_verified": True})
            finished_at = self.clock()
            if finished_at[:10] != started_at[:10]:
                raise ValueError("SCB collection crossed a UTC calendar date; retry as a new snapshot")
            meta = {"schema_version": 1, "source_id": "scb_company_register", "publisher": "SCB",
                    "source_url": SCB_BASE + "/juridiskaenheter", "as_of_date": finished_at[:10],
                    "fetched_at": finished_at, "retrieval_started_at": started_at,
                    "sni_version": "2025", "primary_sni_codes": list(POLICY["primary_sni_codes"]),
                    "population_complete": True, "collections": collections, "acquisition_method": "scb_api_v1",
                    "row_count": len(rows), "terms_url": SCB_TERMS,
                    "reuse_review": reuse_review,
                    "limitations": "Sequential current-register acquisition; equal counts do not prove point-in-time consistency"}
            aliases, relationships = identity_supplement(identities_file, stage, documents, rows)
            snapshot = normalize_snapshot(rows, documents, meta, verified=True,
                aliases=aliases, relationships=relationships)
            write_json(stage / "snapshot.json", snapshot)
            write_json(stage / "population-manifest.json", meta)
            seal(stage)
        return snapshot
