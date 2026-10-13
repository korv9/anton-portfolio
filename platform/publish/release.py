"""Verify immutable public dataset groups, then conditionally activate one snapshot."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from fnmatch import fnmatch
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
from upload import client, CONTENT_TYPES
from warehouse_store import git_commit, sha256

CURRENT = "manifests/current.json"
IMMUTABLE = "public, max-age=31536000, immutable"
SHORT = "no-cache, max-age=0, must-revalidate"
PRIVATE = {"private", "thesis", "raw", "warehouse", "features", "models", "embeddings"}
PRIVATE_ROOT = PRIVATE - {"warehouse"}  # warehouse/delivery is an approved staging location.
EXTENSIONS = {".json", ".parquet", ".csv", ".svg", ".png", ".webp"}
PUBLIC_TYPES = {**CONTENT_TYPES, ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp"}


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                       allow_nan=False) + "\n").encode()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def name(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", value) or value in PRIVATE:
        raise ValueError(f"Invalid public group: {value}")
    return value


def logical(value: str) -> str:
    path = PurePosixPath(value)
    if (not value or value != path.as_posix() or path.is_absolute()
            or any(p in (".", "..") or p.lower() in PRIVATE or p.startswith(".")
                   for p in path.parts) or "\\" in value or ":" in value
            or path.suffix not in EXTENSIONS
            or value in ("delivery.json", "catalog.json", "offloaded.json")):
        raise ValueError(f"Not an approved public logical path: {value}")
    return value


def read(s3, bucket: str, key: str):
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
    except Exception as error:
        if getattr(error, "response", {}).get("Error", {}).get("Code") in (
                "404", "NoSuchKey", "NotFound"):
            return None, None
        raise
    body = response["Body"]
    try:
        return body.read(), response.get("ETag")
    finally:
        body.close()


def verified(s3, bucket: str, entry: dict) -> bytes:
    data, _ = read(s3, bucket, entry["key"])
    if data is None or len(data) != entry["bytes"] or digest(data) != entry["sha256"]:
        raise ValueError(f"Payload verification failed: {entry['key']}")
    return data


def immutable(s3, bucket: str, key: str, data: bytes, content_type: str):
    existing, _ = read(s3, bucket, key)
    if existing is None:
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type,
                      CacheControl=IMMUTABLE, Metadata={"sha256": digest(data)},
                      IfNoneMatch="*")
    elif existing != data:
        raise ValueError(f"Immutable object differs: {key}")
    entry = {"key": key, "bytes": len(data), "sha256": digest(data)}
    verified(s3, bucket, entry)
    return entry


def strict_json(data: bytes):
    def reject(value):
        raise ValueError(f"Non-finite JSON number: {value}")
    return json.loads(data, parse_constant=reject)


def selected(root: Path, spec: dict, catalogue=None) -> list[str]:
    if catalogue is None and (root / "catalog.json").is_file():
        catalogue = json.loads((root / "catalog.json").read_text(encoding="utf-8"))
    known = {entry["path"] for entry in (catalogue or {}).get("files", [])}
    known.update(p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file())
    paths = set(spec.get("files", []))
    paths.update(p for p in spec.get("optional_files", []) if p in known)
    for pattern in spec.get("include", []):
        if pattern.startswith(("/", "\\")) or ".." in PurePosixPath(pattern).parts:
            raise ValueError(f"Invalid include: {pattern}")
        matches = {p for p in known if fnmatch(p, pattern)}
        if not matches:
            raise ValueError(f"Include matched no files: {pattern}")
        paths.update(matches)
    return sorted(p for p in paths if not any(fnmatch(p, pattern) for pattern in spec.get("exclude", [])))


def materialize(s3, bucket: str, root: Path, spec: dict, catalogue: dict, prefer_active=False):
    """Restore selected approved objects, with explicit version-1 hash compatibility."""
    root = root.resolve()
    if any(p.lower() in PRIVATE_ROOT for p in root.parts):
        raise ValueError("Staging root must contain public exports only")
    entries = {entry["path"]: entry for entry in catalogue["files"]}
    current_data, _ = read(s3, bucket, CURRENT)
    active = {}
    if current_data:
        for pointer in strict_json(current_data)["groups"].values():
            active.update(group_manifest(s3, bucket, pointer)["files"])
    known = {"files": [{"path": p} for p in entries.keys() | active.keys()]}
    paths = selected(root, spec, known)
    for relative in paths:
        logical(relative)
        path = root / relative
        if not path.resolve().is_relative_to(root):
            raise ValueError(f"Export escapes staging root: {relative}")
        if path.is_file() and not (prefer_active and relative in active):
            continue
        if relative in active:
            data = verified(s3, bucket, active[relative])
        else:
            entry = entries.get(relative)
            if entry is None:
                raise ValueError(f"Missing uncatalogued export: {relative}")
            data, _ = read(s3, bucket, relative)
            if data is None:
                raise ValueError(f"Missing offloaded object: {relative}")
            # Historical catalogue v1 normalised every payload; new releases never do.
            historical = entry.get("schema_version", catalogue.get("schema_version", 1)) == 1
            checked = data.replace(b"\r\n", b"\n") if historical else data
            # V1 binary hashes were normalised, but their sizes counted the exact bytes.
            size = len(checked) if historical and path.suffix in (".json", ".csv", ".svg") else len(data)
            if size != entry["bytes"] or digest(checked) != entry["sha256"]:
                raise ValueError(f"Offloaded catalogue hash mismatch: {relative}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return {"files": paths, "schema_version": 2}


def check_references(source: str, value, paths: set[str]):
    """Indexed document paths are relative to the nearest containing product root."""
    if isinstance(value, list):
        for item in value:
            check_references(source, item, paths)
    elif isinstance(value, dict):
        for key, item in value.items():
            if key in ("path", "index_path", "shard_path") and isinstance(item, str):
                target = item.removeprefix("/data/").removeprefix("data/")
                logical(target)
                parents = PurePosixPath(source).parents
                candidates = {target, *(str(parent / target) for parent in parents)}
                if not candidates & paths:
                    raise ValueError(f"Unpublished index dependency: {source} -> {item}")
            else:
                check_references(source, item, paths)


def prepare(root: Path, spec: dict, group: str):
    """Freeze approved bytes before checks and any network writes."""
    if spec.get("schema_version") != 2:
        raise ValueError("Publication spec must have schema_version 2")
    root = root.resolve()
    if any(p.lower() in PRIVATE_ROOT for p in root.parts):
        raise ValueError("Staging root must contain public exports only")
    paths = set(selected(root, spec))
    if not paths:
        raise ValueError("A publication group must have files")
    payloads = {}
    for relative in sorted(paths):
        logical(relative)
        path = root / relative
        if not path.resolve().is_relative_to(root) or path.is_symlink():
            raise ValueError(f"Export escapes staging root: {relative}")
        if any(p.is_symlink() for p in path.parents if p != root):
            raise ValueError(f"Symlink export directory: {relative}")
        data = path.read_bytes()
        if path.suffix == ".json":
            value = strict_json(data)
            if relative in spec.get("schemas", {}):
                import jsonschema
                schema = json.loads(Path(spec["schemas"][relative]).read_text(encoding="utf-8"))
                jsonschema.validators.validator_for(schema).check_schema(schema)
                jsonschema.validate(value, schema)
        elif path.suffix == ".parquet":
            import pyarrow.parquet as pq
            import pyarrow as pa
            pq.read_table(pa.BufferReader(data))
        payloads[relative] = data
    # Existing public-data checks cover row counts, columns and successful dbt tests.
    if group == "public-data":
        from validate_public_data import validate, CONTRACTS
        required = {f"{subject}/{item}.json" for subject, items in CONTRACTS.items() for item in items}
        if not required <= paths:
            raise ValueError("public-data must publish all welfare/parliament/taxes contracts")
        validate(root)
    for command in spec.get("checks", []):
        if not isinstance(command, list) or not command or not all(isinstance(x, str) for x in command):
            raise ValueError("checks must contain argv arrays")
        subprocess.run([arg.replace("{root}", str(root)) for arg in command], check=True)
    # Validators run on disk: refuse any race/change after freezing bytes.
    for relative, data in payloads.items():
        if sha256(root / relative) != digest(data):
            raise ValueError(f"Export changed during validation: {relative}")
    # Explicit dependencies for indexes, shards, dataset parts and downloads.
    for source, targets in spec.get("references", {}).items():
        if source not in payloads or not set(targets) <= paths:
            raise ValueError(f"Incomplete references: {source}")
    for path, data in payloads.items():
        if path.endswith("/index.json") or path == "welfare/datasets.json":
            check_references(path, strict_json(data), paths)
    return payloads


def group_manifest(s3, bucket: str, pointer: dict) -> dict:
    manifest = strict_json(verified(s3, bucket, pointer))
    if manifest.get("schema_version") != 2:
        raise ValueError("Unsupported group manifest schema")
    if manifest.get("release") != pointer.get("release"):
        raise ValueError("Group pointer release differs")
    for path, entry in manifest["files"].items():
        logical(path)
        if not entry["key"].startswith(f"releases/{name(manifest['group'])}/{manifest['release']}/files/"):
            raise ValueError("Object outside group release")
    return manifest


def file_indexes(files: dict):
    """Sorted ranges keep both the current manifest and browser file indexes bounded."""
    paths = sorted(files)
    return {paths[start]: {p: files[p] for p in paths[start:start + 100]}
            for start in range(0, len(paths), 100)}


def activate(s3, bucket: str, replacements: dict, expected=None):
    """Merge with current snapshot; CAS prevents another writer being lost."""
    data, etag = read(s3, bucket, CURRENT)
    current = strict_json(data) if data is not None else {"schema_version": 2, "groups": {}}
    if current.get("schema_version") != 2:
        raise ValueError("Unsupported active manifest schema")
    for group, release in (expected or {}).items():
        if current["groups"].get(group, {}).get("release") != release:
            raise ValueError(f"Concurrent writer changed group {group}; rebuild from current")
    candidate = {**current["groups"], **replacements}
    manifests = {g: group_manifest(s3, bucket, p) for g, p in candidate.items()}
    owners = {}
    routes = []
    for g, manifest in manifests.items():
        if manifest["group"] != g:
            raise ValueError("Group identity differs")
        for dep, release in manifest.get("dependencies", {}).items():
            if candidate.get(dep, {}).get("release") != release:
                raise ValueError(f"Incompatible dependency: {g} requires {dep}@{release}")
        for path in manifest["files"]:
            if path in owners:
                raise ValueError(f"Path owned by both {owners[path]} and {g}: {path}")
            owners[path] = g
        routes.extend({"first": first, "last": entry["last"], "group": g, "index": entry}
                      for first, entry in manifest["indexes"].items())
    if current["groups"] == candidate:
        return current
    snapshot = {"schema_version": 2, "groups": candidate,
                "routes": routes,
                "activated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    snapshot["snapshot"] = digest(encoded(candidate))
    condition = {"IfMatch": etag} if data is not None else {"IfNoneMatch": "*"}
    if data is not None and not etag:
        raise ValueError("Active manifest has no ETag; cannot activate safely")
    # Final write. All data and group manifests have already been read back.
    s3.put_object(Bucket=bucket, Key=CURRENT, Body=encoded(snapshot),
                  ContentType="application/json", CacheControl=SHORT, **condition)
    return snapshot


def publish(s3, bucket: str, group: str, root: Path, spec: dict, code_sha=None, stage_only=False):
    name(group)
    current_data, _ = read(s3, bucket, CURRENT)
    expected = {group: strict_json(current_data)["groups"].get(group, {}).get("release") if current_data else None}
    if current_data and group in strict_json(current_data)["groups"]:
        previous = group_manifest(s3, bucket, strict_json(current_data)["groups"][group])
        for path in spec.get("optional_files", []):
            if path in previous["files"] and not (root / path).is_file():
                raise ValueError(f"Previously published optional file must be materialized: {path}")
    payloads = prepare(root, spec, group)
    dependencies = spec.get("dependencies", {})
    for dependency, version in dependencies.items():
        name(dependency)
        if not isinstance(version, str) or not re.fullmatch(r"[a-f0-9]{64}", version):
            raise ValueError("Dependency versions must be full release SHA-256 ids")
    if code_sha and not re.fullmatch(r"[a-f0-9]{40}|[a-f0-9]{64}", code_sha):
        raise ValueError("code_sha must be a Git SHA")
    coverage = spec.get("coverage", {})
    for field, value in coverage.items():
        if field not in {"generated_at", "latest_complete_day", "last_month", "period_start", "period_end"}:
            raise ValueError(f"Unsupported public coverage field: {field}")
        if not isinstance(value, str) or not re.fullmatch(r"[0-9TZ:+.\-]+", value):
            raise ValueError(f"Coverage must contain dates only: {field}")
    identity = {"files": {p: digest(b) for p, b in payloads.items()},
                "dependencies": dependencies, "schema_version": 2,
                "references": spec.get("references", {}),
                "schemas": {p: digest(Path(s).read_bytes()) for p, s in spec.get("schemas", {}).items()},
                "checks": spec.get("checks", []), "coverage": spec.get("coverage", {})}
    release = digest(encoded(identity))
    prefix = f"releases/{group}/{release}/"
    files = {}
    for path, data in payloads.items():
        files[path] = immutable(s3, bucket, prefix + "files/" + path, data,
                                PUBLIC_TYPES.get(Path(path).suffix, "application/octet-stream"))
    indexes = {}
    for first, entries in file_indexes(files).items():
        data = encoded(entries)
        indexes[first] = immutable(s3, bucket, prefix + "indexes/" + digest(data) + ".json",
                                   data, "application/json")
        indexes[first]["last"] = max(entries)
    key = prefix + "manifest.json"
    existing, _ = read(s3, bucket, key)
    manifest = {"schema_version": 2, "group": group, "release": release, "files": files,
                "indexes": indexes,
                "dependencies": dependencies, "coverage": spec.get("coverage", {}),
                "published_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "code_sha": code_sha or git_commit(), "hash_algorithm": "sha256-exact-bytes"}
    if existing is not None:
        previous = strict_json(existing)
        if previous["files"] != files or previous["dependencies"] != dependencies:
            raise ValueError("Existing group manifest differs")
        manifest = previous
    pointer = immutable(s3, bucket, key, encoded(manifest), "application/json")
    pointer["release"] = release
    pointer["published_at"] = manifest["published_at"]
    pointer["dependencies"] = dependencies
    return pointer if stage_only else activate(s3, bucket, {group: pointer}, expected)


def release_pointer(s3, bucket: str, group: str, release: str):
    name(group)
    if not re.fullmatch(r"[0-9a-f]{64}", release):
        raise ValueError("Release must be a full SHA-256 release id")
    key = f"releases/{group}/{release}/manifest.json"
    data, _ = read(s3, bucket, key)
    if data is None:
        raise ValueError("No previously verified release manifest")
    pointer = {"key": key, "sha256": digest(data), "bytes": len(data), "release": release}
    manifest = group_manifest(s3, bucket, pointer)
    pointer["published_at"] = manifest["published_at"]
    pointer["dependencies"] = manifest["dependencies"]
    for entry in manifest["files"].values():
        verified(s3, bucket, entry)
    for entry in manifest["indexes"].values():
        verified(s3, bucket, entry)
    return pointer


def rollback(s3, bucket: str, group: str, release: str):
    return activate(s3, bucket, {group: release_pointer(s3, bucket, group, release)})


def main():
    global CURRENT
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    put = commands.add_parser("publish")
    put.add_argument("--group", required=True)
    put.add_argument("--root", type=Path, required=True)
    put.add_argument("--spec", type=Path, required=True)
    put.add_argument("--code-sha")
    put.add_argument("--stage-only", action="store_true")
    restore = commands.add_parser("materialize")
    restore.add_argument("--root", type=Path, required=True)
    restore.add_argument("--spec", type=Path, required=True)
    restore.add_argument("--catalog", type=Path, required=True)
    restore.add_argument("--prefer-active", action="store_true",
                         help="restore active verified files over stale local exports before regeneration")
    bundle = commands.add_parser("activate")
    bundle.add_argument("--release", action="append", required=True, help="GROUP=SHA256, repeat for bundle")
    undo = commands.add_parser("rollback")
    undo.add_argument("--group", required=True)
    undo.add_argument("--release", required=True)
    for command in (put, restore, bundle, undo):
        command.add_argument("--manifest-key", default=CURRENT,
                             help="active manifest key; use a separate manifests/smoke-NAME.json for drift tests")
    args = parser.parse_args()
    try:
        if not re.fullmatch(r"manifests/[a-z0-9][a-z0-9-]*\.json", args.manifest_key):
            raise ValueError("Manifest key must be manifests/NAME.json")
        CURRENT = args.manifest_key
        s3, bucket = client()
        if args.command == "publish":
            spec = json.loads(args.spec.read_text(encoding="utf-8"))
            result = publish(s3, bucket, args.group, args.root, spec, args.code_sha, args.stage_only)
        elif args.command == "materialize":
            result = materialize(s3, bucket, args.root,
                                 json.loads(args.spec.read_text(encoding="utf-8")),
                                 json.loads(args.catalog.read_text(encoding="utf-8")), args.prefer_active)
        elif args.command == "activate":
            choices = dict(item.split("=", 1) for item in args.release)
            result = activate(s3, bucket, {g: release_pointer(s3, bucket, g, r) for g, r in choices.items()})
        else:
            result = rollback(s3, bucket, args.group, args.release)
        print(json.dumps(result))
    except Exception as error:
        parser.exit(1, f"Publication failed; active manifest was not intentionally replaced: {error}\n")


if __name__ == "__main__":
    main()
