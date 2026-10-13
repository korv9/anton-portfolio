"""Publication transactions through a conditional-write fake S3, with real fixture bytes."""
import hashlib
import io
import json
import sys
from pathlib import Path

import duckdb
import pytest
from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish"))
import release as r
import build_catalog as catalog


class S3:
    def __init__(self):
        self.objects = {}
        self.puts = []
        self.reads = []
        self.fail = None
        self.corrupt = False
        self.conflict = False

    def error(self, code):
        return ClientError({"Error": {"Code": code}}, "Object")

    def get_object(self, Bucket, Key):
        self.reads.append(Key)
        if Key not in self.objects:
            raise self.error("NoSuchKey")
        data = self.objects[Key]["Body"]
        return {"Body": io.BytesIO(data), "ETag": '"' + r.digest(data) + '"'}

    def put_object(self, **args):
        key = args["Key"]
        if self.fail and self.fail in key:
            raise RuntimeError("Interrupted upload")
        old = self.objects.get(key)
        if args.get("IfNoneMatch") == "*" and old:
            raise self.error("PreconditionFailed")
        if args.get("IfMatch") and (self.conflict or not old or args["IfMatch"] != '"' + r.digest(old["Body"]) + '"'):
            raise self.error("PreconditionFailed")
        self.puts.append(key)
        self.objects[key] = args.copy()
        if self.corrupt and "/files/" in key:
            self.objects[key]["Body"] += b"damaged"


def spec(*paths, **kwargs):
    return {"schema_version": 2, "files": list(paths), **kwargs}


def write(root, path, data):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)


@pytest.fixture
def exports(tmp_path):
    write(tmp_path, "jobs/market.json", b'{"generated_at":"2026-10-12","data":[1]}\r\n')
    write(tmp_path, "parliament/news.json", b'{"generated_at":"2026-10-11","items":[]}\n')
    return tmp_path


def test_first_publish_unchanged_republish_activation_last_and_exact_payload(exports):
    s3 = S3()
    current = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert s3.puts[-1] == r.CURRENT
    pointer = current["groups"]["jobs"]
    group = r.group_manifest(s3, "bucket", pointer)
    entry = group["files"]["jobs/market.json"]
    assert entry["sha256"] == hashlib.sha256((exports / "jobs/market.json").read_bytes()).hexdigest()
    assert entry["key"] in s3.reads
    assert s3.objects[r.CURRENT]["IfNoneMatch"] == "*"
    assert s3.objects[entry["key"]]["CacheControl"] == r.IMMUTABLE
    assert s3.objects[r.CURRENT]["CacheControl"] == r.SHORT
    before = list(s3.puts)
    assert r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json")) == current
    assert s3.puts == before


@pytest.mark.parametrize("failure", ["upload", "hash", "activation", "auth"])
def test_failed_attempt_keeps_previous_active(exports, failure):
    s3 = S3()
    r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    old = s3.objects[r.CURRENT]["Body"]
    write(exports, "jobs/market.json", b'{"data":[2]}')
    if failure == "upload":
        s3.fail = "/files/"
    elif failure == "hash":
        s3.corrupt = True
    elif failure == "activation":
        s3.conflict = True
    else:
        def denied(**kwargs):
            raise s3.error("AccessDenied")
        s3.get_object = denied
    with pytest.raises((RuntimeError, ValueError, ClientError)):
        r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert s3.objects[r.CURRENT]["Body"] == old


def test_isolation_rollback_and_download_indexes(exports):
    s3 = S3()
    jobs = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))["groups"]["jobs"]
    both = r.publish(s3, "bucket", "news", exports, spec("parliament/news.json"))
    news = both["groups"]["news"]
    write(exports, "jobs/market.json", b'{"data":[3]}')
    updated = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert updated["groups"]["news"] == news
    assert s3.objects[r.CURRENT]["IfMatch"]
    undone = r.rollback(s3, "bucket", "jobs", jobs["release"])
    assert undone["groups"] == both["groups"]
    for route in undone["routes"]:
        entries = r.strict_json(r.verified(s3, "bucket", route["index"]))
        assert len(entries) <= 100
        for entry in entries.values():
            r.verified(s3, "bucket", entry)
    with pytest.raises(ValueError, match="No previously"):
        r.rollback(s3, "bucket", "jobs", "0" * 64)


def test_atomic_bundle_and_forward_reverse_dependencies(exports):
    s3 = S3()
    jobs = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"), stage_only=True)
    news = r.publish(s3, "bucket", "news", exports,
                     spec("parliament/news.json", dependencies={"jobs": jobs["release"]}), stage_only=True)
    assert r.CURRENT not in s3.objects
    initial = r.activate(s3, "bucket", {"jobs": jobs, "news": news})
    write(exports, "jobs/market.json", b'{"data":[4]}')
    with pytest.raises(ValueError, match="Incompatible"):
        r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert s3.objects[r.CURRENT]["Body"] == r.encoded(initial)
    with pytest.raises(ValueError, match="Path owned"):
        r.publish(s3, "bucket", "other", exports, spec("jobs/market.json"))


def test_optional_files_and_catalog_materialization(exports):
    s3 = S3()
    summary = "parliament/news-summaries.json"
    news_spec = spec("parliament/news.json", optional_files=[summary])
    r.publish(s3, "bucket", "news", exports, news_spec)
    write(exports, summary, b'{"generated_at":"2026-10-08","summary":"approved"}\r\n')
    with_summary = r.publish(s3, "bucket", "news", exports, news_spec)
    (exports / summary).unlink()
    with pytest.raises(ValueError, match="must be materialized"):
        r.publish(s3, "bucket", "news", exports, news_spec)
    r.materialize(s3, "bucket", exports, news_spec, {"files": []})
    assert (exports / summary).exists()
    assert r.publish(s3, "bucket", "news", exports, news_spec) == with_summary
    old_path = "politics/parliament/issues/1993-94/gh092.json"
    raw = b'{"speeches":[]}\r\n'
    s3.objects[old_path] = {"Body": raw}
    legacy = {"schema_version": 1, "files": [{"path": old_path,
              "sha256": r.digest(raw.replace(b"\r\n", b"\n")), "bytes": len(raw) - 1}]}
    r.materialize(s3, "bucket", exports, {"include": ["politics/*"]}, legacy)
    assert (exports / old_path).read_bytes() == raw
    (exports / old_path).unlink()
    s3.objects[old_path]["Body"] = b"broken"
    with pytest.raises(ValueError, match="hash mismatch"):
        r.materialize(s3, "bucket", exports, {"include": ["politics/*"]}, legacy)
    assert not (exports / old_path).exists()


def test_schema_checks_indexes_and_private_exports(exports):
    s3 = S3()
    schema = exports / "market-schema.json"
    schema.write_text(json.dumps({"type": "object", "required": ["missing"]}))
    import jsonschema
    with pytest.raises(jsonschema.ValidationError):
        r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json", schemas={"jobs/market.json": str(schema)}))
    assert not s3.puts
    write(exports, "politics/parliament/issues/index.json", b'{"data":[{"index_path":"issues/1993-94/index.json"}]}')
    with pytest.raises(ValueError, match="Unpublished index"):
        r.publish(s3, "bucket", "baseline", exports, spec("politics/parliament/issues/index.json"))
    for path in ("../secret.json", "private/thesis.json", "warehouse/raw/a.json", "thesis.pdf", "delivery.json"):
        with pytest.raises(ValueError, match="public logical"):
            r.publish(s3, "bucket", "baseline", exports, spec(path))


def test_catalog_exact_parquet_and_legacy_carried_entries(exports, monkeypatch):
    path = exports / "parquet/welfare/sample.parquet"
    path.parent.mkdir(parents=True)
    con = duckdb.connect()
    con.execute("copy (select 'line' || chr(13) || chr(10) || 'end' as value) to ? (format parquet)", [str(path)])
    con.close()
    monkeypatch.setattr(catalog, "PUBLIC", exports)
    monkeypatch.setattr(catalog, "CATALOG", exports / "catalog.json")
    monkeypatch.setattr(catalog, "DELIVERY", exports / "delivery.json")
    built = catalog.build()
    assert built["schema_version"] == 2
    entry = next(e for e in built["files"] if e["path"] == "parquet/welfare/sample.parquet")
    assert entry["sha256"] == r.digest(path.read_bytes())
    s3 = S3()
    r.publish(s3, "bucket", "sample", exports, spec(entry["path"]))
    assert s3.puts[-1] == r.CURRENT


def test_lazy_index_bounds_for_realistic_shard_tree():
    files = {f"politics/parliament/issues/{year}-94/doc-{n}.json": {} for year in range(1993, 1998) for n in range(125)}
    indexes = r.file_indexes(files)
    assert all(len(v) <= 100 for v in indexes.values())
    assert set().union(*(v.keys() for v in indexes.values())) == files.keys()


def test_public_data_contracts_checked_before_activation(tmp_path):
    from test_public_data_contracts import public
    root = public.__wrapped__(tmp_path)
    s3 = S3()
    current = r.publish(s3, "bucket", "public-data", root, {"schema_version": 2, "include": ["*"]})
    assert "public-data" in current["groups"]
    previous = s3.objects[r.CURRENT]["Body"]
    datasets = root / "welfare/datasets.json"
    value = json.loads(datasets.read_text())
    value[0]["rows"] = 99
    datasets.write_text(json.dumps(value))
    with pytest.raises(AssertionError):
        r.publish(s3, "bucket", "public-data", root, {"schema_version": 2, "include": ["*"]})
    assert s3.objects[r.CURRENT]["Body"] == previous


def test_other_group_update_during_upload_is_merged(exports, monkeypatch):
    s3 = S3()
    r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    write(exports, "jobs/market.json", b'{"data":[6]}')
    original = r.immutable
    injected = False
    def during_upload(*args):
        nonlocal injected
        if not injected:
            injected = True
            r.publish(s3, "bucket", "news", exports, spec("parliament/news.json"))
        return original(*args)
    monkeypatch.setattr(r, "immutable", during_upload)
    current = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert current["groups"].keys() == {"jobs", "news"}


def test_same_group_update_during_upload_is_refused(exports, monkeypatch):
    s3 = S3()
    r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    write(exports, "jobs/market.json", b'{"data":[7]}')
    competing = r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"), stage_only=True)
    write(exports, "jobs/market.json", b'{"data":[8]}')
    original = r.immutable
    injected = False
    def during_upload(*args):
        nonlocal injected
        if not injected:
            injected = True
            r.activate(s3, "bucket", {"jobs": competing})
        return original(*args)
    monkeypatch.setattr(r, "immutable", during_upload)
    with pytest.raises(ValueError, match="Concurrent writer"):
        r.publish(s3, "bucket", "jobs", exports, spec("jobs/market.json"))
    assert json.loads(s3.objects[r.CURRENT]["Body"])["groups"]["jobs"] == competing


def test_catalog_v1_carried_entries_and_include_excludes(exports, monkeypatch):
    old = {"path": "politics/parliament/issues/1993-94/offloaded.json", "schema_version": 1,
           "format": "shard", "sha256": "a" * 64, "bytes": 10}
    write(exports, "catalog.json", r.encoded({"schema_version": 1, "files": [old], "bases": {"shard": "https://data.test/"}}))
    write(exports, "offloaded.json", r.encoded([old["path"]]))
    monkeypatch.setattr(catalog, "PUBLIC", exports)
    monkeypatch.setattr(catalog, "CATALOG", exports / "catalog.json")
    monkeypatch.setattr(catalog, "DELIVERY", exports / "delivery.json")
    carried = next(e for e in catalog.build()["files"] if e["path"] == old["path"])
    assert carried["schema_version"] == 1
    assert carried["hash_algorithm"] == "sha256-crlf-normalized"
    selected = r.selected(exports, {"include": ["*"], "exclude": ["catalog.json", "offloaded.json", "parliament/*"]})
    assert selected == ["jobs/market.json", old["path"]]
    with pytest.raises(FileNotFoundError):
        r.prepare(exports, spec(old["path"]), "baseline")


def test_v1_parquet_keeps_exact_size_and_legacy_hash_then_v2_exact_bytes(exports):
    relative = "parquet/fact_member_vote/session=2024-25/part-0.parquet"
    path = exports / relative
    path.parent.mkdir(parents=True)
    con = duckdb.connect()
    con.execute("copy (select 'line' || chr(13) || chr(10) || 'end' as value) to ? "
                "(format parquet, compression uncompressed)", [str(path)])
    con.close()
    data = path.read_bytes()
    normalised = data.replace(b"\r\n", b"\n")
    assert len(normalised) < len(data)
    path.unlink()
    s3 = S3()
    s3.objects[relative] = {"Body": data}
    legacy = {"schema_version": 1, "files": [{"path": relative, "format": "parquet",
              "bytes": len(data), "sha256": r.digest(normalised)}]}
    r.materialize(s3, "bucket", exports, spec(relative), legacy)
    assert path.read_bytes() == data
    pointer = r.publish(s3, "bucket", "baseline", exports, spec(relative), stage_only=True)
    entry = r.group_manifest(s3, "bucket", pointer)["files"][relative]
    assert entry["sha256"] == r.digest(data) and entry["bytes"] == len(data)
    path.unlink()
    s3.objects[relative]["Body"] = data.replace(b"line", b"bine")
    with pytest.raises(ValueError, match="hash mismatch"):
        r.materialize(s3, "bucket", exports, spec(relative), legacy)
    assert not path.exists()


def test_legacy_delivery_client_trims_credential_whitespace(monkeypatch):
    import delivery
    import boto3
    monkeypatch.setattr(delivery, "_s3", None)
    monkeypatch.setattr(delivery, "load_env", lambda: None)
    values = {"R2_ACCOUNT_ID": "a" * 32, "R2_ACCESS_KEY_ID": "b" * 32,
              "R2_SECRET_ACCESS_KEY": "c" * 64, "R2_BUCKET": "fixture-bucket",
              "S3_API_ENDPOINT": "https://s3.example.test/fixture-bucket"}
    for key, value in values.items():
        monkeypatch.setenv(key, " " + value + "\n")
    captured = {}
    def fake_client(service, **kwargs):
        captured.update(kwargs)
        return "fixture-client"
    monkeypatch.setattr(boto3, "client", fake_client)
    assert delivery._bucket_client() == ("fixture-client", "fixture-bucket")
    assert captured["endpoint_url"] == "https://s3.example.test"
    assert captured["aws_access_key_id"] == values["R2_ACCESS_KEY_ID"]
    assert captured["aws_secret_access_key"] == values["R2_SECRET_ACCESS_KEY"]
    monkeypatch.setattr(delivery, "_s3", None)
    monkeypatch.setenv("R2_BUCKET", " \n")
    assert delivery._bucket_client() is None


def test_catalog_rebuild_keeps_explicit_live_connection(exports, monkeypatch):
    url = "https://data.test/manifests/current.json"
    write(exports, "delivery.json", r.encoded({"schema_version": 2, "manifest_url": url}))
    monkeypatch.setattr(catalog, "PUBLIC", exports)
    monkeypatch.setattr(catalog, "CATALOG", exports / "catalog.json")
    monkeypatch.setattr(catalog, "DELIVERY", exports / "delivery.json")
    monkeypatch.setattr(sys, "argv", ["build_catalog.py"])
    monkeypatch.delenv("R2_MANIFEST_URL", raising=False)
    monkeypatch.delenv("R2_LIVE_DELIVERY", raising=False)
    catalog.main()
    assert json.loads((exports / "delivery.json").read_text())["manifest_url"] == url
    override = "https://other.test/manifests/current.json"
    monkeypatch.setenv("R2_MANIFEST_URL", override)
    catalog.main()
    assert json.loads((exports / "delivery.json").read_text())["manifest_url"] == override


def test_prefer_active_preserves_newer_summary_after_optional_failure(exports):
    s3 = S3()
    summary = "parliament/news-summaries.json"
    news_spec = spec("parliament/news.json", optional_files=[summary])
    newer = b'{"generated_at":"2026-10-13","summary":"new approved version"}'
    write(exports, summary, newer)
    previous = r.publish(s3, "bucket", "news", exports, news_spec)
    write(exports, summary, b'{"generated_at":"2026-10-08","summary":"stale checkout"}')
    r.materialize(s3, "bucket", exports, news_spec, {"files": []}, prefer_active=True)
    assert (exports / summary).read_bytes() == newer
    # Optional summarization fails and writes nothing; newly fetched headlines still publish.
    write(exports, "parliament/news.json", b'{"generated_at":"2026-10-14","items":[{"title":"new headline"}]}')
    current = r.publish(s3, "bucket", "news", exports, news_spec)
    assert current["groups"]["news"]["release"] != previous["groups"]["news"]["release"]
    group = r.group_manifest(s3, "bucket", current["groups"]["news"])
    assert r.verified(s3, "bucket", group["files"][summary]) == newer
    fresh = b'{"generated_at":"2026-10-15","summary":"fresh local exporter"}'
    write(exports, summary, fresh)
    r.materialize(s3, "bucket", exports, news_spec, {"files": []})
    assert (exports / summary).read_bytes() == fresh


def test_cli_stage_bundle_rollback_and_restore_are_isolated(exports, monkeypatch, capsys):
    s3 = S3()
    monkeypatch.setattr(r, "client", lambda: (s3, "bucket"))
    monkeypatch.setattr(r, "CURRENT", r.CURRENT)
    key = "manifests/smoke-regression.json"
    jobs_spec = exports / "jobs-spec.json"
    jobs_spec.write_bytes(r.encoded(spec("jobs/market.json")))
    news_spec = exports / "news-spec.json"
    news_spec.write_bytes(r.encoded(spec("parliament/news.json")))
    cat = exports / "restore-catalog.json"
    cat.write_bytes(r.encoded({"files": []}))
    def run(*args):
        monkeypatch.setattr(sys, "argv", ["release.py", *args, "--manifest-key", key])
        r.main()
        return json.loads(capsys.readouterr().out.splitlines()[-1])
    jobs = run("publish", "--group", "jobs", "--root", str(exports), "--spec", str(jobs_spec), "--stage-only")
    news = run("publish", "--group", "news", "--root", str(exports), "--spec", str(news_spec), "--stage-only")
    assert key not in s3.objects
    active = run("activate", "--release", "jobs=" + jobs["release"], "--release", "news=" + news["release"])
    assert active["groups"].keys() == {"jobs", "news"}
    assert s3.puts[-1] == key
    assert "manifests/current.json" not in s3.objects
    puts = list(s3.puts)
    assert run("current", "--group", "jobs") == {"release": jobs["release"]}
    assert run("current", "--group", "missing") == {"release": None}
    assert s3.puts == puts
    original = (exports / "parliament/news.json").read_bytes()
    write(exports, "parliament/news.json", b'{"stale":true}')
    run("materialize", "--root", str(exports), "--spec", str(news_spec), "--catalog", str(cat), "--prefer-active")
    assert (exports / "parliament/news.json").read_bytes() == original
    write(exports, "jobs/market.json", b'{"data":[9]}')
    run("publish", "--group", "jobs", "--root", str(exports), "--spec", str(jobs_spec))
    undone = run("rollback", "--group", "jobs", "--release", jobs["release"])
    assert undone["groups"] == active["groups"]


def test_approved_image_mime_types(exports):
    s3 = S3()
    images = {"figures/chart.svg": "image/svg+xml", "figures/map.png": "image/png", "figures/map.webp": "image/webp"}
    for path in images:
        write(exports, path, b"approved-image-fixture")
    current = r.publish(s3, "bucket", "figures", exports, spec(*images))
    manifest = r.group_manifest(s3, "bucket", current["groups"]["figures"])
    for path, content_type in images.items():
        assert s3.objects[manifest["files"][path]["key"]]["ContentType"] == content_type
