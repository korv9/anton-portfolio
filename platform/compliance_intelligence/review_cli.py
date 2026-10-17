"""Phase 3 extraction, evidence-bound proposals and human review; no automatic publishing."""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import uuid
from pathlib import Path

import duckdb
from jsonschema import ValidationError
from pypdf.errors import PyPdfError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import load_env  # noqa: E402
from lib.rawstore import sha256  # noqa: E402
from compliance_intelligence.authority_http import AuthorityHttp, AccessFailure  # noqa: E402
from compliance_intelligence.legal_extraction import (  # noqa: E402
    LLM_INSTRUCTIONS, SCHEMA, document_pages, extract_candidate,
)
from compliance_intelligence.legal_review import ReviewStore  # noqa: E402
from compliance_intelligence.registry import relative_file  # noqa: E402
from compliance_intelligence.sources import load_snapshot, now, write_json  # noqa: E402

LOG = logging.getLogger(__name__)


def evidence_body(store, doc, *, refresh=False, original_file=None, clients=None, http_factory=AuthorityHttp):
    method, matched, result = "stable_reference", None, "original_unavailable"
    try:
        if original_file:
            body, method = Path(original_file).read_bytes(), "supplied_original"
        elif doc["storage_ref"]:
            body = relative_file(store.root, doc["storage_ref"]).read_bytes()
            method = "retained_original"
        elif refresh:
            method = "reference_refetch"
            if clients is None:
                raise ValueError("http_client_pool_required")
            source = doc["source_id"]
            if source not in clients:
                def attempt(url, status, number, metadata, error):
                    store.audit("evidence_http_attempt", {"source_id": source, "source_url": url,
                        "status": status, "attempt": number, "error": error})

                def robots(url, status, digest, rules):
                    store.audit("evidence_robots_check", {"source_id": source, "source_url": url,
                        "status": status, "document_hash": digest, "rules": rules})

                clients[source] = http_factory(source, attempt, robots)
            _, status, _, body = clients[source].get(doc["source_url"])
            if status != 200:
                raise ValueError("source_body_not_returned")
        else:
            raise ValueError("original_unavailable")
        matched = sha256(body) == doc["document_hash"]
        if not matched:
            result = "source_bytes_changed_reingest_phase2"
            raise ValueError(result)
        result = "hash_verified"
        return body
    except AccessFailure as exc:
        result = exc.code
        raise
    finally:
        store.execute("insert into review.evidence_access values (?,?,?,?,?,?)",
                      [str(uuid.uuid4()), doc["document_id"], now(), method, matched, result])


def run_extraction(root, *, registry=None, refresh=False, max_documents=2, http_factory=AuthorityHttp):
    if not 1 <= max_documents <= 10000:
        raise ValueError("invalid_document_bound")
    store = ReviewStore(root)
    clients, seen, results, halted = {}, set(), [], set()
    snapshot = load_snapshot(registry) if registry else None
    try:
        documents = store.execute("""select d.document_id from bronze.resource r
            join bronze.document_version d using(document_id) where lower(d.content_type) like '%pdf%'
            order by d.source_id,d.source_url""").fetchall()
        for document_id, in documents:
            doc = store.document(document_id)
            if doc["document_hash"] in seen:
                continue
            seen.add(doc["document_hash"])
            if len(results) >= max_documents:
                break
            if doc["source_id"] in halted:
                results.append({"document_id": document_id, "status": "source_halted"})
                continue
            try:
                body = evidence_body(store, doc, refresh=refresh, clients=clients, http_factory=http_factory)
                pages = document_pages(body, doc["content_type"])
                if not any(pages.values()):
                    raise ValueError("no_text_ocr_not_run")
                record = extract_candidate(doc, pages)
                created = store.add_candidate(record, pages, snapshot=snapshot)
                results.append({"document_id": document_id, "status": "candidate", **created})
            except (ValueError, AccessFailure, OSError, PyPdfError, ValidationError) as exc:
                code = exc.code if hasattr(exc, "code") else (str(exc) if type(exc) is ValueError else type(exc).__name__)
                # Extractor/validation messages may contain source text; keep only stable codes.
                code = code if len(code) < 160 and "\n" not in code else type(exc).__name__
                results.append({"document_id": document_id, "status": "held", "reason": code})
                if isinstance(exc, AccessFailure) and exc.halt:
                    halted.add(doc["source_id"])
        summary = {"run_id": str(uuid.uuid4()), "finished_at": now(), "documents": results, **store.summary()}
        path = relative_file(store.root, "review/reports/" + summary["run_id"] + ".json")
        write_json(path, summary)
        return summary
    finally:
        for client in clients.values():
            client.close()
        store.close()


def main(argv=None):
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("COMPLIANCE_PRIVATE_ROOT", ".research/compliance-intelligence")) / "decisions")
    sub = parser.add_subparsers(dest="command", required=True)
    extract = sub.add_parser("extract")
    extract.add_argument("--registry", type=Path)
    extract.add_argument("--refresh-references", action="store_true")
    extract.add_argument("--max-documents", type=int, default=2)
    imported = sub.add_parser("import-proposal", help="Manual or structured LLM JSON; never imports approval")
    imported.add_argument("--proposal", type=Path, required=True)
    imported.add_argument("--registry", type=Path)
    imported.add_argument("--original-file", type=Path)
    imported.add_argument("--refresh-references", action="store_true")
    imported.add_argument("--prepared-by", required=True)
    sub.add_parser("schema")
    sub.add_parser("queue")
    sub.add_parser("summary")
    sub.add_parser("verify-audit")
    show = sub.add_parser("show")
    show.add_argument("--record-hash", required=True)
    review = sub.add_parser("review")
    review.add_argument("--request", type=Path, required=True)
    review.add_argument("--reviewers", type=Path, required=True, help="Operator-maintained authorized human roster")
    export = sub.add_parser("export-gold")
    export.add_argument("--output", type=Path, required=True)
    validate = sub.add_parser("validate-release")
    validate.add_argument("--bundle", type=Path, required=True)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    store, clients = None, {}
    try:
        if args.command == "schema":
            result = {"schema": SCHEMA, "instructions": LLM_INSTRUCTIONS,
                      "external_model_calls": False, "document_text_requires_separate_egress_clearance": True}
        elif args.command == "extract":
            result = run_extraction(args.root, registry=args.registry, refresh=args.refresh_references,
                                    max_documents=args.max_documents)
        else:
            store = ReviewStore(args.root)
            if args.command == "import-proposal":
                record = json.loads(args.proposal.read_text(encoding="utf-8"))
                doc = store.document(record["document_id"])
                body = evidence_body(store, doc, refresh=args.refresh_references, original_file=args.original_file, clients=clients)
                result = store.add_candidate(record, document_pages(body, doc["content_type"]),
                    snapshot=load_snapshot(args.registry) if args.registry else None, prepared_by=args.prepared_by)
            elif args.command == "review":
                result = store.review(json.loads(args.request.read_text(encoding="utf-8")),
                                      json.loads(args.reviewers.read_text(encoding="utf-8")))
            elif args.command == "show":
                preview = store.gold_record(args.record_hash)
                preview["review_status"] = "preview_not_approved"
                result = {**store.record(args.record_hash), "context_hash": store.context(args.record_hash),
                          "publication_preview": preview}
            elif args.command == "queue":
                result = store.queue()
            elif args.command == "summary":
                result = store.summary()
            elif args.command == "verify-audit":
                result = store.verify_audit()
            elif args.command == "validate-release":
                result = store.validate_release(args.bundle)
            else:
                result = store.export_gold(args.output)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if args.command == "extract" and any(d["status"] != "candidate" for d in result["documents"]) else 0
    except (ValueError, OSError, KeyError, TypeError, duckdb.Error, ValidationError, PyPdfError) as exc:
        message = str(exc) if type(exc) is ValueError else ""
        code = message if re.fullmatch(r"[a-z][a-z0-9_:,]{0,300}", message) else type(exc).__name__
        LOG.error("Phase 3 held: %s", code)
        return 2
    finally:
        for client in clients.values():
            client.close()
        if store:
            store.close()


if __name__ == "__main__":
    sys.exit(main())
