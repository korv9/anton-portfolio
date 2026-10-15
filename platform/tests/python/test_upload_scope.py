"""platform/publish/upload.py --only: one prefix is uploaded and offloaded, the rest left alone."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

import upload  # noqa: E402


def test_only_scopes_entries_and_offload_keeps_earlier_records(tmp_path, monkeypatch):
    entries = [{"path": "workers-ai/sfs/meta.json"}, {"path": "politics/decisions/a.json"}]
    assert upload.scoped(entries, "workers-ai/sfs/") == entries[:1]
    assert upload.scoped(entries, None) == entries

    (tmp_path / "workers-ai/sfs").mkdir(parents=True)
    (tmp_path / "workers-ai/sfs/meta.json").write_text("{}", encoding="utf-8")
    offloaded = tmp_path / "offloaded.json"
    offloaded.write_text(json.dumps(["politics/decisions/a.json"]), encoding="utf-8")
    monkeypatch.setattr(upload, "PUBLIC", tmp_path)
    monkeypatch.setattr(upload, "OFFLOADED", offloaded)
    upload.offload(entries[:1], merge=True)
    assert json.loads(offloaded.read_text(encoding="utf-8")) == [
        "politics/decisions/a.json", "workers-ai/sfs/meta.json"]
    assert not (tmp_path / "workers-ai/sfs/meta.json").exists()
