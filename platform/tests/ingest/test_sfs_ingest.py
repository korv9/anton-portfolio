"""platform/ingest/sfs/ingest.py --all: the whole list past the API's 50-page cap, and a rerun
that fetches only what is missing or changed."""
import importlib.util
from pathlib import Path

# Another ingest.py (riksdagen) is on the path as `ingest`, so load this one by file.
spec = importlib.util.spec_from_file_location(
    "sfs_ingest", Path(__file__).resolve().parents[2] / "ingest" / "sfs" / "ingest.py")
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)


class Listing:
    """51 pages of one document each when sorted newest first; the API refuses page 51."""

    def get(self, url, timeout):
        order = "asc" if "sortorder=asc" in url else "desc"
        page = int(url.rsplit("p=", 1)[1])
        number = page if order == "desc" else 52 - page
        doc = {"dok_id": f"sfs-2000-{number}", "beteckning": f"2000:{number}", "titel": "Lag",
               "datum": "2000-01-01", "organ": "", "subtyp": "sfst",
               "systemdatum": f"2026-10-{number % 2 + 14} 04:00:00"}
        body = {"dokumentlista": {"@traffar": "51", "@sidor": "51", "dokument": [doc]}}
        return type("Response", (), {"raise_for_status": lambda self: None,
                                     "json": lambda self: body})()


def test_catalogue_reads_past_the_page_cap_and_refetches_changed_texts(monkeypatch):
    monkeypatch.setattr(ingest, "FULL_PAUSE", 0)
    monkeypatch.setattr(ingest.time, "sleep", lambda seconds: None)
    docs = ingest.catalogue(Listing())
    assert [doc["dok_id"] for doc in docs] == sorted(f"sfs-2000-{n}" for n in range(1, 52))

    # Every text was fetched on 2026-10-15; the odd ones changed on 2026-10-15, the even
    # ones on 2026-10-14. Changed the day of the fetch or later means fetch again.
    ages = {}
    monkeypatch.setattr(ingest.rawstore, "session", Listing)
    monkeypatch.setattr(ingest.rawstore, "store", lambda *args, **kwargs: None)
    monkeypatch.setattr(ingest.rawstore, "verified_record",
                        lambda source, relative: {"fetched_at": "2026-10-15T10:00:00+00:00"})
    monkeypatch.setattr(ingest.rawstore, "fetch", lambda http, source, relative, url, **kw:
                        ages.__setitem__(relative, kw["max_age_days"]))
    assert ingest.fetch_all(None) == 0
    assert ages["texts/sfs-2000-1.text"] == 0
    assert ages["texts/sfs-2000-2.text"] > 0
