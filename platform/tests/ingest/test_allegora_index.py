"""platform/publish/allegora/sfs_index.py: which documents Allegora's whole-SFS index keeps."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "publish" / "allegora"))

from sfs_index import batches, document_passages, kind  # noqa: E402

DOC = {"dok_id": "sfs-2099-1", "beteckning": "2099:1", "titel": "Lag (2099:1) om prov"}
TEXT = """Lag (2099:1) om prov

SFS nr:     2099:1
{repealed}Källa: Regeringskansliet / Lagrummet

1 § Lagen gäller prov.

2 § Den som provar ska anmäla det.
"""


def test_kind_follows_int_sfs_documents():
    assert kind("Lag (1982:80) om anställningsskydd") == "lag"
    assert kind("Brottsbalk (1962:700)") == "lag"
    assert kind("Regeringsform (1974:152)") == "lag"
    assert kind("Förordning (2008:1162) om utbetalning") == "förordning"
    assert kind("Kungörelse (1960:1) om något") == "other"


def test_repealed_documents_are_left_out_on_their_date_not_before():
    kept = document_passages(DOC, TEXT.format(repealed=""), "2099-06-01")
    assert [p["id"] for p in kept] == ["sfs-2099-1-1", "sfs-2099-1-2"]
    assert kept[0]["url"].endswith("/_sfs-2099-1/#P1")
    assert kept[0]["kind"] == "lag"
    future = TEXT.format(repealed="Upphävd:   2099-07-01\n")
    assert len(document_passages(DOC, future, "2099-06-01")) == 2
    assert document_passages(DOC, future, "2099-07-01") == []


def test_batches_respect_the_request_limits():
    rows = [{"title": "t", "text": "x" * 999} for _ in range(100)]
    groups = batches(rows)
    assert sum(len(g) for g in groups) == 100
    assert all(sum(len(r["text"]) + 1 for r in g) <= 40_000 for g in groups)
