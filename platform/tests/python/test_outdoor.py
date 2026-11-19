"""The outdoor subject: reading the SL fact books, the daypart model and the two pre-registered
predictions (docs/research/preregistrations/outdoor-preregistration.md). The counts' totals per
edition are a dbt test (platform/tests/outdoor/outdoor_printed_totals.sql)."""
import importlib.util
import sys
from pathlib import Path

import numpy as np
import pymupdf

ROOT = Path(__file__).resolve().parents[3]


def load(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


sl_facts = load("outdoor_sl_facts", "platform/ingest/outdoor/sl_facts.py")
sys.path.insert(0, str(ROOT / "platform/publish/outdoor"))
dayparts = load("dayparts", "platform/publish/outdoor/dayparts.py")
predict = load("predict", "platform/publish/outdoor/predict.py")


def pdf(lines: list[str]):
    """A one-page PDF with one line of text per entry, 14 points apart."""
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=1400)
    for i, line in enumerate(lines):  # an HTML box embeds a font with å, ä, ö and the en dash
        page.insert_htmlbox(pymupdf.Rect(40, 90 + 14 * i, 560, 104 + 14 * i), line, css="*{font-size:9px}")
    return doc


def test_appendix_rows_sum_lines_and_skip_totals():
    doc = pdf(["Påstigande vintervardag 2018 – tunnelbana", "Hållplats", "Bana", "Dygn",
               "Abrahamsberg", "Gröna linjen", "4 900", "1 900", "1 000", "800", "200",
               "Gamla stan", "Gröna linjen", "10 900", "600", "400", "3 300", "1 300",
               "Gamla stan", "Röda linjen", "14 800", "800", "500", "4 400", "1 800",
               "Totalt gröna linjen", "565 400", "1", "1", "1", "1"])
    rows = sl_facts.appendix_rows(doc, sl_facts.appendix_pages(doc))
    assert [(r["station"], r["line"], r["day"]) for r in rows] == [
        ("Abrahamsberg", "green", 4900), ("Gamla stan", "green", 10900), ("Gamla stan", "red", 14800)]
    assert rows[0]["h0730_0830"] == 1000


def test_appendix_skips_2013_sub_rows_per_line():
    doc = pdf(["Påstigande vintervardag 2013 – tunnelbana", "Fridhemsplan", "58 200", "11 100",
               "6 100", "17 200", "6 700", "Gröna linjen", "31 000", "5 900", "3 300", "9 200",
               "3 500", "Blå linjen", "Hjulsta", "2 600", "600", "300", "600", "200"])
    rows = sl_facts.appendix_rows(doc, sl_facts.appendix_pages(doc))
    assert [(r["station"], r["day"]) for r in rows] == [("Fridhemsplan", 58200), ("Hjulsta", 2600)]


def test_skipped_names():
    assert all(sl_facts.skipped(n) for n in ("Blå linjen", "Totalt röda linjen", "Tunnelbana totalt", "Varav pendel"))
    assert not sl_facts.skipped("Kungsträdgården")


def test_dayparts_keep_the_counted_bands():
    dayparts.demo()


def test_predictions_follow_the_preregistered_rules():
    predict.demo()
    rng = np.random.default_rng(1)
    X = np.column_stack([np.ones(40), rng.normal(size=40)])
    y = rng.normal(size=40)  # no signal: the model cannot beat the median
    assert predict.check(X, y)["label"] == "not_better_than_median"
    # A slip rate of one year per year or more never opens.
    never = predict.opening(2030.0, 2026.0, [(1.0, 1.0), (1.0, 2.0)], rng)
    assert never["after_2060"] == 1.0 and never["p50"] is None and never["p10"] is None
    assert predict.opening_point(2028, quarter=4) == 2028.875
