"""Storing the warehouse in R2: a round trip through an in-memory bucket. The warehouse comes back
byte for byte, raw files and the ML stages' outputs are uploaded once and only again when they change, and a damaged copy
in the bucket is refused instead of replacing the local warehouse."""
import gzip
import json
import sys
from pathlib import Path

import duckdb
import pytest
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "publish"))

import warehouse_store as ws  # noqa: E402


class Bucket:
    """The handful of S3 calls the store makes, kept in a dict."""

    class exceptions:
        ClientError = ClientError

    def __init__(self):
        self.objects: dict[str, tuple[bytes, dict]] = {}
        self.uploads = 0

    def _missing(self):
        return ClientError({"Error": {"Code": "404"}}, "HeadObject")

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise self._missing()
        body, meta = self.objects[Key]
        return {"ContentLength": len(body), "Metadata": meta}

    def upload_file(self, filename, bucket, key, ExtraArgs=None):
        self.uploads += 1
        self.objects[key] = (Path(filename).read_bytes(), (ExtraArgs or {}).get("Metadata", {}))

    def download_file(self, bucket, key, filename):
        Path(filename).write_bytes(self.objects[key][0])

    def put_object(self, Bucket, Key, Body, ContentType=None):
        self.objects[Key] = (Body, {})

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise self._missing()

        class Stream:
            def __init__(self, data):
                self.data = data

            def read(self):
                return self.data

        return {"Body": Stream(self.objects[Key][0])}

    def delete_object(self, Bucket, Key):
        self.objects.pop(Key, None)

    def get_paginator(self, name):
        objects = self.objects

        class Pages:
            def paginate(self, Bucket, Prefix):
                yield {"Contents": [{"Key": k, "Size": len(v[0])}
                                    for k, v in objects.items() if k.startswith(Prefix)]}

        return Pages()


@pytest.fixture
def store(tmp_path, monkeypatch):
    db = tmp_path / "portfolio.duckdb"
    con = duckdb.connect(str(db))
    con.execute("create schema gold")
    con.execute("create table gold.t as select range as id from range(5)")
    con.close()
    raw = tmp_path / "raw"
    (raw / "scb").mkdir(parents=True)
    (raw / "scb/a.json").write_text('{"a": 1}')
    (raw / "scb/_manifest.jsonl").write_text('{"url": "https://example.org"}\n')
    monkeypatch.setattr(ws, "DATABASE", db)
    features = tmp_path / "features"
    (features / "concepts").mkdir(parents=True)
    (features / "concepts/run.json").write_text('{"model": "m"}')
    monkeypatch.setattr(ws, "RAW", raw)
    monkeypatch.setattr(ws, "FEATURES", features)
    return Bucket(), db, raw


def test_round_trip_restores_the_warehouse_and_raw_files(store):
    s3, db, raw = store
    original = db.read_bytes()
    files, sent, _ = ws.push_tree(s3, "b", "raw")
    manifest = ws.push_db(s3, "b", {"raw": files})
    assert (files, sent) == (2, 2)
    assert manifest["rows_per_schema"] == {"gold": 5}
    assert gzip.decompress(s3.objects[ws.DB_KEY][0]) == original
    assert json.loads(s3.objects[ws.MANIFEST_KEY][0])["sha256"] == manifest["sha256"]

    db.unlink()
    (raw / "scb/a.json").unlink()
    assert ws.pull_db(s3, "b")
    assert ws.pull_tree(s3, "b", "raw") == 1
    assert db.read_bytes() == original
    assert (raw / "scb/a.json").read_text() == '{"a": 1}'


def test_unchanged_raw_files_are_not_uploaded_again(store):
    s3, _, raw = store
    ws.push_tree(s3, "b", "raw")
    before = s3.uploads
    assert ws.push_tree(s3, "b", "raw")[1] == 0
    (raw / "scb/a.json").write_text('{"a": 2}')
    assert ws.push_tree(s3, "b", "raw")[1] == 1
    assert s3.uploads == before + 1


def test_a_damaged_stored_copy_does_not_replace_the_local_warehouse(store):
    s3, db, _ = store
    ws.push_db(s3, "b", {})
    body, meta = s3.objects[ws.DB_KEY]
    s3.objects[ws.DB_KEY] = (gzip.compress(b"not the warehouse"), meta)
    original = db.read_bytes()
    with pytest.raises(SystemExit):
        ws.pull_db(s3, "b")
    assert db.read_bytes() == original


def test_nothing_stored_yet_is_not_an_error(store):
    s3, _, _ = store
    assert ws.pull_db(s3, "b") is False
    assert ws.pull_tree(s3, "b", "raw") == 0
    assert ws.pull_tree(s3, "b", "features") == 0


def test_ml_outputs_are_stored_under_their_own_prefix_and_come_back(store, tmp_path):
    s3, _, _ = store
    files, sent, _ = ws.push_tree(s3, "b", "features")
    assert (files, sent) == (1, 1)
    assert ws.FEATURES_PREFIX + "concepts/run.json" in s3.objects
    assert not any(k.startswith(ws.RAW_PREFIX) for k in s3.objects)
    (tmp_path / "features/concepts/run.json").unlink()
    assert ws.pull_tree(s3, "b", "features") == 1
    assert (tmp_path / "features/concepts/run.json").read_text() == '{"model": "m"}'


def test_a_push_path_outside_the_tree_is_refused(store, tmp_path):
    s3, _, _ = store
    (tmp_path / "x").mkdir()
    (tmp_path / "x/secret.txt").write_text("no")
    with pytest.raises(ValueError, match="outside"):
        ws.push_tree(s3, "b", "features", "../x")
    assert not s3.objects


def test_cluster_lab_pushes_only_the_listed_runs_never_the_cache(store, tmp_path, monkeypatch):
    s3, _, _ = store
    lab = tmp_path / "cluster_lab"
    (lab / "cache/text_vectors").mkdir(parents=True)
    (lab / "cache/text_vectors/vectors.sqlite").write_bytes(b"big")
    (lab / "workers-ai-debate-bge-m3").mkdir()
    (lab / "workers-ai-debate-bge-m3/manifest.json").write_text("{}")
    monkeypatch.setattr(ws, "CLUSTER_LAB", lab)
    for sub in ws.folders("cluster_lab", [""]):
        ws.push_tree(s3, "b", "cluster_lab", sub)
    assert sorted(s3.objects) == [ws.CLUSTER_LAB_PREFIX + "workers-ai-debate-bge-m3/manifest.json"]
    assert ws.folders("raw", [""]) == [""]


def test_one_folder_or_file_of_a_tree_moves_alone(store):
    """The daily refreshes store and fetch only their own folder and provenance log."""
    s3, _, raw = store
    (raw / "jobtech/stream").mkdir(parents=True)
    (raw / "jobtech/stream/state.json").write_text('{"fetched_until": "x"}')
    (raw / "jobtech/streamed.json").write_text("{}")
    (raw / "jobtech/_manifest.jsonl").write_text("{}\n")
    assert ws.push_tree(s3, "b", "raw", "jobtech/stream")[:2] == (1, 1)
    assert ws.push_tree(s3, "b", "raw", "jobtech/_manifest.jsonl")[:2] == (1, 1)
    assert not any(k.endswith(("scb/a.json", "streamed.json")) for k in s3.objects)
    ws.push_tree(s3, "b", "raw")
    for path in ("jobtech/stream/state.json", "jobtech/_manifest.jsonl", "scb/a.json"):
        (raw / path).unlink()
    # A folder does not match its name's prefix (jobtech/streamed.json), a file matches itself.
    assert ws.pull_tree(s3, "b", "raw", "jobtech/stream") == 1
    assert ws.pull_tree(s3, "b", "raw", "jobtech/_manifest.jsonl") == 1
    assert (raw / "jobtech/stream/state.json").exists()
    assert not (raw / "scb/a.json").exists()


def test_third_party_text_kept_local_is_never_pushed(store):
    """The bucket is public: raw/philosophy_moral (Reddit comments, GPL data) stays on the machine."""
    s3, _, raw = store
    (raw / "philosophy_moral/ethics").mkdir(parents=True)
    (raw / "philosophy_moral/mfrc.parquet").write_text("comments")
    (raw / "philosophy_moral/ethics/test.csv").write_text("scenarios")
    ws.push_tree(s3, "b", "raw")
    assert ws.push_tree(s3, "b", "raw", "philosophy_moral")[:2] == (0, 0)
    assert not any("philosophy_moral" in key for key in s3.objects)
    assert ws.RAW_PREFIX + "scb/a.json" in s3.objects


def test_corrupt_or_interrupted_raw_download_keeps_local_checkpoint(store, monkeypatch):
    s3, _, raw = store
    path = raw / "scb/a.json"
    ws.push_tree(s3, "b", "raw")
    original = path.read_bytes()
    key = ws.RAW_PREFIX + "scb/a.json"
    _, meta = s3.objects[key]
    s3.objects[key] = (b"broken!", meta)
    path.write_bytes(b"local checkpoint")
    with pytest.raises(ValueError, match="integrity"):
        ws.pull_tree(s3, "b", "raw")
    assert path.read_bytes() == b"local checkpoint"
    assert not path.with_name(path.name + ".tmp").exists()
    s3.objects[key] = (original, meta)
    def interrupted(bucket, key, filename):
        Path(filename).write_bytes(b"partial")
        raise TimeoutError("download")
    monkeypatch.setattr(s3, "download_file", interrupted)
    with pytest.raises(TimeoutError):
        ws.pull_tree(s3, "b", "raw")
    assert path.read_bytes() == b"local checkpoint"


def test_pruning_scoped_snapshot_removes_obsolete_pages_and_never_uploads_temp_files(store):
    s3, _, raw = store
    ws.push_tree(s3, "b", "raw")
    key = ws.RAW_PREFIX + "scb/stale.json"
    s3.objects[key] = (b"{}", {})
    s3.objects[ws.RAW_PREFIX + "scb_extra/keep.json"] = (b"{}", {})
    (raw / "scb/partial.json.tmp").write_bytes(b"partial")
    # One of three stored files is far above the default share: an intentional cleanup says so.
    ws.push_tree(s3, "b", "raw", "scb", prune=True, max_delete_pct=100)
    assert key not in s3.objects
    assert ws.RAW_PREFIX + "scb/partial.json.tmp" not in s3.objects
    assert ws.RAW_PREFIX + "scb_extra/keep.json" in s3.objects


def test_a_prune_beyond_the_share_or_without_the_fetch_log_deletes_nothing(store):
    """An incomplete restore looks like a mass deletion; the default 5 % guard stops it."""
    s3, _, raw = store
    for i in range(38):
        (raw / f"scb/page-{i}.json").write_text("{}")
    ws.push_tree(s3, "b", "raw", "scb")
    stored = set(s3.objects)
    assert len(stored) == 40
    for i in range(3):
        (raw / f"scb/page-{i}.json").unlink()
    with pytest.raises(SystemExit, match="3 of 40 stored files"):
        ws.push_tree(s3, "b", "raw", "scb", prune=True)
    assert set(s3.objects) == stored
    (raw / "scb/page-0.json").write_text("{}")
    (raw / "scb/page-1.json").write_text("{}")
    manifest = raw / "scb/_manifest.jsonl"
    log = manifest.read_bytes()
    manifest.unlink()
    with pytest.raises(SystemExit, match="fetch log"):
        ws.push_tree(s3, "b", "raw", "scb", prune=True)
    assert set(s3.objects) == stored
    manifest.write_bytes(log)
    ws.push_tree(s3, "b", "raw", "scb", prune=True)
    assert set(s3.objects) == stored - {ws.RAW_PREFIX + "scb/page-2.json"}


def test_complete_history_survives_a_fresh_runner_round_trip(store, tmp_path, monkeypatch):
    import sys
    sys.path.insert(0, str(ROOT / "ingest/taxes"))
    import taxes_ingest as taxes
    import rawstore

    s3, _, raw = store
    monkeypatch.setattr(rawstore, "RAW", raw)
    monkeypatch.setattr(rawstore.time, "sleep", lambda _: None)
    monkeypatch.delenv("PORTFOLIO_FULL_REFRESH", raising=False)
    class HTTP:
        calls = 0
        def get(self, url, **kwargs):
            self.calls += 1
            class Response:
                content = b'{"resultCount":1,"results":[{"id":"a"}]}'
                def raise_for_status(self):
                    pass
            return Response()
    http = HTTP()
    taxes.rowstore_pages(http, "tables", "withholding/2020", {}, 90)
    ws.push_tree(s3, "b", "raw", "skatteverket")
    restored = tmp_path / "new-runner/raw"
    monkeypatch.setattr(ws, "RAW", restored)
    monkeypatch.setattr(rawstore, "RAW", restored)
    assert ws.pull_tree(s3, "b", "raw", "skatteverket") == 3
    taxes.rowstore_pages(http, "tables", "withholding/2020", {}, 90)
    assert http.calls == 1
    taxes.rowstore_pages(http, "tables", "withholding/2026", {}, 0)
    assert http.calls == 2


def test_a_whole_tree_pull_skips_the_on_demand_corpus_but_a_named_pull_fetches_it(store):
    """The weekly build pulls all raw files; the 2.4 GB job-ad corpus comes only when named."""
    s3, _, raw = store
    (raw / "jobtech/cluster-corpus/2025").mkdir(parents=True)
    (raw / "jobtech/cluster-corpus/2025/part.parquet").write_text("x")
    ws.push_tree(s3, "b", "raw")
    (raw / "jobtech/cluster-corpus/2025/part.parquet").unlink()
    (raw / "scb/a.json").unlink()
    ws.pull_tree(s3, "b", "raw")
    assert (raw / "scb/a.json").exists()
    assert not (raw / "jobtech/cluster-corpus/2025/part.parquet").exists()
    assert ws.pull_tree(s3, "b", "raw", "jobtech/cluster-corpus") == 1
    assert (raw / "jobtech/cluster-corpus/2025/part.parquet").exists()
