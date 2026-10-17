"""Opt-in Phase 1: acquire a register snapshot, resolve identities and freeze a cohort."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.common import load_env  # noqa: E402
from compliance_intelligence.cohort import build_cohort, verify_cohort  # noqa: E402
from compliance_intelligence.registry import explore, resolve  # noqa: E402
from compliance_intelligence.sources import ScbClient, ingest_local, load_snapshot, now  # noqa: E402


def main(argv=None):
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    status = commands.add_parser("status", help="Report available inputs without making API requests")
    status.add_argument('--cohort',type=Path,help='Verify and report an existing frozen cohort instead of assuming selection has not run')
    ingest = commands.add_parser("ingest", help="SCB API, or CSV/Parquet with provenance metadata")
    ingest.add_argument("--source", choices=("auto", "scb", "file"), default="auto")
    ingest.add_argument("--input", type=Path)
    ingest.add_argument("--metadata", type=Path)
    ingest.add_argument("--identities", type=Path)
    ingest.add_argument("--output", type=Path)
    ingest.add_argument("--page-size", type=int, default=5000)
    ingest.add_argument("--max-pages", type=int, default=1000)
    ingest.add_argument("--reuse-reviewed-by", help="Identify the person who checked the source reuse terms")
    build = commands.add_parser("build", help="Validate and freeze exactly 50 legal entities")
    build.add_argument("--snapshot", type=Path, required=True)
    build.add_argument("--cohort-id", required=True)
    build.add_argument("--output", type=Path)
    build.add_argument('--private-only',action='store_true',help='Freeze a direct SCB research sample without asserting human source-reuse/publication approval')
    check = commands.add_parser("verify", help="Check original evidence, bundle hashes and frozen membership")
    check.add_argument("--bundle", type=Path, required=True)
    search = commands.add_parser("search", help="Read-only exploratory search, independent of cohort selection")
    search.add_argument("--snapshot", type=Path, required=True)
    search.add_argument("--query", required=True)
    search.add_argument("--limit", type=int, default=20)
    search.add_argument("--cohort", type=Path, help="Optional original cohort bundle to label membership")
    match = commands.add_parser("resolve", help="Conservative direct entity resolution; never follow group links")
    match.add_argument("--snapshot", type=Path, required=True)
    match.add_argument("--number")
    match.add_argument("--name")
    match.add_argument("--country", default="SE")
    match.add_argument("--on-date")
    match.add_argument("--registry-authority")
    match.add_argument("--registry-number")
    match.add_argument("--subject-role", choices=("company", "issuer"), default="company")
    args = parser.parse_args(argv)
    root = Path(os.environ.get("COMPLIANCE_PRIVATE_ROOT") or ".research/compliance-intelligence")
    try:
        if args.command == "status":
            source_file = os.environ.get("COMPLIANCE_COMPANY_FILE")
            metadata_file = os.environ.get("COMPLIANCE_COMPANY_METADATA")
            local = bool(source_file and Path(source_file).is_file())
            provenance = bool(metadata_file and Path(metadata_file).is_file())
            available = bool(os.environ.get("SCB_API_KEY", "").strip()) or (local and provenance)
            result = {"status": "input_available" if available else "awaiting_authorized_data",
                      "scb_api_key_configured": bool(os.environ.get("SCB_API_KEY", "").strip()),
                      "local_extract_present": local, "local_metadata_present": provenance,
                      "cohort_generation": "not_checked"}
            if args.cohort:
                result.update(cohort_generation='frozen',cohort=verify_cohort(args.cohort))
        elif args.command == "ingest":
            source = args.input or os.environ.get("COMPLIANCE_COMPANY_FILE")
            metadata = args.metadata or os.environ.get("COMPLIANCE_COMPANY_METADATA")
            output = args.output or root / ("snapshot-" + now().replace(":", "-").replace("+", "_"))
            if args.source == "file" or (args.source == "auto" and source):
                if not source or not metadata:
                    raise ValueError("Local fallback requires --input CSV/Parquet and --metadata provenance JSON")
                snapshot = ingest_local(source, metadata, output, identities_file=args.identities)
            else:
                reuse_review = {"reviewer_id": args.reuse_reviewed_by, "reviewed_at": now()} if args.reuse_reviewed_by else None
                snapshot = ScbClient().ingest(output, page_size=args.page_size, max_pages=args.max_pages,
                    identities_file=args.identities, reuse_review=reuse_review)
            result = {"snapshot": str(output), "company_count": len(snapshot["companies"]),
                      "conflict_count": len(snapshot["conflicts"]), "excluded_rows": len(snapshot["exclusions"]),
                      "population_complete": snapshot["metadata"].get("population_complete", False)}
        elif args.command == "build":
            output = args.output or root / args.cohort_id
            result = {"output": str(output), **build_cohort(args.snapshot, output, args.cohort_id,private_only=args.private_only)}
        elif args.command == "verify":
            result = verify_cohort(args.bundle)
        elif args.command == "search":
            snapshot = load_snapshot(args.snapshot)
            if args.cohort:
                verify_cohort(args.cohort)
            cohort = (args.cohort or args.snapshot) / "cohort.json"
            cohort_ids = {r["company_id"] for r in json.loads(cohort.read_text(encoding="utf-8"))} if cohort.exists() else set()
            result = explore(snapshot, args.query, cohort_ids=cohort_ids, limit=args.limit)
        else:
            result = resolve(load_snapshot(args.snapshot), number=args.number, name=args.name, country=args.country,
                on_date=args.on_date, registry_authority=args.registry_authority,
                registry_number=args.registry_number, subject_role=args.subject_role)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (ValueError, KeyError, OSError) as exc:
        print("Compliance Phase 1: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
