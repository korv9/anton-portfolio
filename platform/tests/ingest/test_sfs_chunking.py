"""platform/ingest/sfs/chunking.py: a law's text from Riksdagen into one passage per §."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest" / "sfs"))

from chunking import LONG, paragraphs  # noqa: E402

HEADER = """Lag (2099:1) om prov\r
\r
SFS nr:     2099:1\r
Ändrad:     t.o.m. SFS 2099:9\r
Källa: Regeringskansliet / Lagrummet\r
\r
\r
"""

LAW = HEADER + """1 kap. Inledande bestämmelser

Lagens syfte

1 § Denna lag gäller prov
och har en radbruten mening. Lag (2099:5).

Andra stycket hör till samma
paragraf.

2 § Med prov avses

1. det första,

2. det andra.

3 § /Upphör att gälla U:2000-01-01/
Den gamla lydelsen.

3 § /Träder i kraft I:2000-01-01/
Den nya lydelsen. Lag (2099:7).

4 § /Upphör att gälla U:den dag som regeringen bestämmer/
Gäller fortfarande.

4 § /Träder i kraft I:den dag som regeringen bestämmer/
Gäller ännu inte.

5 § Har upphävts genom lag (2099:3).

2 a kap. Långa paragrafer

1 a § {long_one}

{long_two}

Övergångsbestämmelser

2099:1
1. Denna lag träder i kraft den 1 januari 2100.
"""


def chunks(text: str) -> dict:
    sentence = "Ett stycke med ord. " * (LONG // 40)
    text = text.format(long_one=sentence, long_two=sentence.replace("Ett", "Ett annat"))
    return {c["id"]: c for c in paragraphs(text, sfs="2099:1", name="Provlagen",
                                           fetched="2026-10-14")}


def test_chapters_paragraphs_and_amendment_metadata():
    found = chunks(LAW)
    first = found["sfs-2099-1-1-1"]
    assert first["title"] == "Provlagen 1 kap. 1 §"
    assert first["text"] == ("Denna lag gäller prov och har en radbruten mening.\n\n"
                             "Andra stycket hör till samma paragraf.")
    assert first["amended_by"] == "2099:5"
    assert "Lagens syfte" not in first["text"]
    assert found["sfs-2099-1-1-2"]["text"] == "Med prov avses\n1. det första,\n2. det andra."


def test_only_the_version_in_force_and_no_repealed_paragraphs():
    found = chunks(LAW)
    assert found["sfs-2099-1-1-3"]["text"] == "Den nya lydelsen."
    assert found["sfs-2099-1-1-4"]["text"] == "Gäller fortfarande."
    assert "sfs-2099-1-1-5" not in found


def test_long_paragraph_splits_per_stycke_and_transitional_provisions_are_cut():
    found = chunks(LAW)
    assert {"sfs-2099-1-2a-1a-1", "sfs-2099-1-2a-1a-2"} <= set(found)
    assert found["sfs-2099-1-2a-1a-2"]["title"] == "Provlagen 2 a kap. 1 a §, andra stycket"
    assert not any("träder i kraft den 1 januari" in c["text"] for c in found.values())


def test_law_without_chapters():
    found = chunks(HEADER + "1 § Första.\n\n2 § Andra. Lag (2099:2).\n")
    assert list(found) == ["sfs-2099-1-1", "sfs-2099-1-2"]
    assert found["sfs-2099-1-2"]["text"] == "Andra."
