"""Release retention against the conditional-write fake S3 of test_release.py."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import release as r
import retention
from test_release import S3, exports, no_local_dbt_results, spec, write  # noqa: F401 (fixtures)

START = datetime(2026, 10, 1, tzinfo=timezone.utc)


class Listing(S3):
    """Adds what retention needs: LastModified, listing and batch deletion."""
    def __init__(self):
        super().__init__()
        self.clock = START
        self.deleted = []

    def put_object(self, **args):
        super().put_object(**args)
        self.objects[args["Key"]]["LastModified"] = self.clock

    def get_paginator(self, operation):
        assert operation == "list_objects_v2"
        objects = self.objects

        class Pages:
            def paginate(self, Bucket, Prefix):
                yield {"Contents": [{"Key": k, "LastModified": v["LastModified"]}
                                    for k, v in sorted(objects.items()) if k.startswith(Prefix)]}
        return Pages()

    def delete_objects(self, Bucket, Delete):
        for item in Delete["Objects"]:
            self.deleted.append(item["Key"])
            del self.objects[item["Key"]]
        return {}


def releases(s3, group):
    return {k.split("/")[2] for k in s3.objects if k.startswith(f"releases/{group}/")}


def publish_days(s3, root, count):
    """One jobs release a day; returns release ids, oldest first."""
    ids = []
    for day in range(count):
        s3.clock = START + timedelta(days=day)
        write(root, "jobs/market.json", json.dumps({"data": [day]}).encode())
        ids.append(r.publish(s3, "bucket", "jobs", root, spec("jobs/market.json"))["groups"]["jobs"]["release"])
    return ids


def test_dry_run_deletes_nothing_then_apply_keeps_active_and_two_previous(exports):
    s3 = Listing()
    ids = publish_days(s3, exports, 6)
    news = r.publish(s3, "bucket", "news", exports, spec("parliament/news.json"))["groups"]["news"]["release"]
    before = dict(s3.objects)
    plan = retention.plan(s3, "bucket", now=START + timedelta(days=30))
    assert s3.objects == before and not s3.deleted
    assert plan["jobs"]["deleted"] == sorted(ids[:3]) and plan["news"]["deleted"] == []
    keys = plan["jobs"]["keys"]
    assert all(k.endswith("/manifest.json") for k in keys[:3]) and not keys[3].endswith("/manifest.json")
    retention.delete(s3, "bucket", [k for g in plan.values() for k in g["keys"]])
    assert releases(s3, "jobs") == set(ids[3:]) and releases(s3, "news") == {news}
    # Both remaining previous releases are still complete rollback targets.
    assert r.rollback(s3, "bucket", "jobs", ids[3])["groups"]["jobs"]["release"] == ids[3]


def test_rolled_back_and_smoke_referenced_releases_are_kept(exports):
    s3 = Listing()
    ids = publish_days(s3, exports, 6)
    r.rollback(s3, "bucket", "jobs", ids[1])
    smoke = json.loads(s3.objects[r.CURRENT]["Body"])
    smoke["groups"]["jobs"] = {**smoke["groups"]["jobs"], "release": ids[0]}
    s3.put_object(Key="manifests/pipeline-smoke.json", Body=r.encoded(smoke))
    plan = retention.plan(s3, "bucket", now=START + timedelta(days=30))["jobs"]
    assert plan["active"] == ids[1]
    assert plan["kept"] == sorted({ids[0], ids[1], ids[4], ids[5]})
    assert plan["deleted"] == sorted(ids[2:4])


def test_interrupted_uploads_are_deleted_only_after_the_safety_age(exports):
    s3 = Listing()
    publish_days(s3, exports, 1)
    old, fresh = "a" * 64, "b" * 64
    s3.clock = START
    s3.put_object(Key=f"releases/jobs/{old}/files/jobs/market.json", Body=b"{}")
    s3.clock = START + timedelta(days=9)
    s3.put_object(Key=f"releases/jobs/{fresh}/files/jobs/market.json", Body=b"{}")
    s3.put_object(Key="releases/jobs/not-a-release/x.json", Body=b"{}")
    plan = retention.plan(s3, "bucket", now=START + timedelta(days=10))["jobs"]
    assert plan["deleted"] == [old]


def test_refuses_without_a_readable_active_manifest(exports):
    s3 = Listing()
    publish_days(s3, exports, 1)
    current = s3.objects.pop(r.CURRENT)
    with pytest.raises(ValueError, match="Cannot read"):
        retention.plan(s3, "bucket")
    s3.objects[r.CURRENT] = {**current, "Body": b"{not json"}
    with pytest.raises(ValueError):
        retention.plan(s3, "bucket")
    assert not s3.deleted


def test_refuses_when_the_active_release_is_not_listed(exports):
    s3 = Listing()
    (active,) = publish_days(s3, exports, 1)
    del s3.objects[f"releases/jobs/{active}/manifest.json"]
    with pytest.raises(ValueError, match="not listed"):
        retention.plan(s3, "bucket")


def test_cli_is_a_dry_run_unless_applied(exports, monkeypatch, capsys):
    s3 = Listing()
    ids = publish_days(s3, exports, 4)
    monkeypatch.setattr(r, "client", lambda: (s3, "bucket"))
    monkeypatch.setattr(sys, "argv", ["retention.py"])
    retention.main()
    report = json.loads(capsys.readouterr().out)
    assert report["applied"] is False and report["groups"]["jobs"]["deleted"] == [ids[0]]
    assert not s3.deleted
    monkeypatch.setattr(sys, "argv", ["retention.py", "--apply"])
    retention.main()
    assert releases(s3, "jobs") == set(ids[1:])
