"""platform/legal: parsing EU acts from both XHTML renderings, comparing versions, Cellar."""
import sys
from pathlib import Path

PLATFORM = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PLATFORM))
sys.path.insert(0, str(PLATFORM / "lib"))
sys.path.insert(0, str(PLATFORM / "ingest" / "eu_ai_act"))

from legal.cellar import eurlex_url, parse_related, related_query  # noqa: E402
from legal.parse import (  # noqa: E402
    annex_references, article_references, compare, definitions, english_date, parse_act,
    text_hash,
)

NS = 'xmlns="http://www.w3.org/1999/xhtml"'

# The Official Journal rendering: oj-* classes, ELI ids, footnote calls as oj-note-tag.
OJ = f"""<html {NS}><body>
<div id="rct_1"><p class="oj-normal">(1) The purpose of this Regulation is set out.</p></div>
<div id="cpt_I"><p class="oj-ti-section-1">CHAPTER I</p>
 <div class="eli-title" id="cpt_I.tit_1"><p class="oj-ti-section-2"><span>GENERAL PROVISIONS</span></p></div>
 <div class="eli-subdivision" id="art_1"><p class="oj-ti-art">Article 1</p>
  <div class="eli-title" id="art_1.tit_1"><p class="oj-sti-art">Subject matter</p></div>
  <div id="001.001"><p class="oj-normal">1.   Providers shall comply with Article 2 and Articles 4 to 6 of
   Directive (EU) 2016/943 (<a><span class="oj-super oj-note-tag">12</span></a>) and Annex III.</p></div>
 </div>
 <div class="eli-subdivision" id="art_2"><p class="oj-ti-art">Article 2</p>
  <div class="eli-title" id="art_2.tit_1"><p class="oj-sti-art">Definitions</p></div>
  <p class="oj-normal">For the purposes of this Regulation:</p>
  <table><tbody><tr><td><p class="oj-normal">(1)</p></td>
   <td><p class="oj-normal">‘provider’ means a person that develops an AI system;</p></td></tr></tbody></table>
  <table><tbody><tr><td><p class="oj-normal">(2)</p></td>
   <td><p class="oj-normal">‘authority’ means:</p></td></tr></tbody></table>
  <table><tbody><tr><td><p class="oj-normal">(a)</p></td>
   <td><p class="oj-normal">a public body;</p></td></tr></tbody></table>
 </div>
 <div class="eli-subdivision" id="art_3"><p class="oj-ti-art">Article 3</p>
  <div class="eli-title" id="art_3.tit_1"><p class="oj-sti-art">Threshold</p></div>
  <p class="oj-normal">Above 10<span class="oj-super">25</span> operations.</p>
 </div>
</div>
<div id="anx_I"><p class="oj-doc-ti">ANNEX I</p><p class="oj-doc-ti">List of legislation</p>
 <p class="oj-normal">1. Directive on toys.</p></div>
</body></html>"""

# The consolidated rendering: norm classes, ▼ markers (modref names the amending act, arrow the
# base act), a chapter title without a .tit_1 id, footnote calls as <a href="#E…">.
CONSOLIDATED = f"""<html {NS}><body>
<div id="cpt_I"><p class="title-division-1">CHAPTER I</p>
 <p class="title-division-2"><span class="boldface">GENERAL PROVISIONS</span></p>
 <div class="eli-subdivision" id="art_1"><p class="title-article-norm">Article 1</p>
  <div class="eli-title" id="art_1.tit_1"><p class="stitle-article-norm">Subject matter</p></div>
  <div class="norm"><span class="no-parag">1.  </span><div class="norm inline-element">Providers shall comply
   with Article 2 and Articles 4 to 6 of Directive (EU) 2016/943 (<a href="#E0001"><span class="superscript">1</span></a>)
   and Annex III.</div></div>
 </div>
 <p class="modref"><a title="32026R1744: REPLACED">▼M1</a></p>
 <div class="eli-subdivision" id="art_2"><p class="title-article-norm">Article 2</p>
  <div class="eli-title" id="art_2.tit_1"><p class="stitle-article-norm">Definitions</p></div>
  <p class="norm">For the purposes of this Regulation:</p>
  <div class="grid-container grid-list"><div class="list grid-list-column-1"><span>(1) </span></div>
   <div class="grid-list-column-2"><p class="norm">‘provider’ means a person that develops or trains an AI system;</p></div></div>
 </div>
 <p class="modref"><a title="32026R1744: INSERTED">▼M1</a></p>
 <div class="eli-subdivision" id="art_2a"><p class="title-article-norm">Article 2a</p>
  <div class="eli-title" id="art_2a.tit_1"><p class="stitle-article-norm">New article</p></div>
  <p class="norm">Inserted text.</p>
 </div>
 <p class="arrow"><a title="32024R1689">▼B</a></p>
 <div class="eli-subdivision" id="art_3"><p class="title-article-norm">Article 3</p>
  <div class="eli-title" id="art_3.tit_1"><p class="stitle-article-norm">Threshold</p></div>
  <p class="norm">Above 10<span class="superscript">25</span> operations.</p>
 </div>
</div>
<div id="anx_I"><p class="title-annex-1">ANNEX I</p><p class="title-annex-2">List of legislation</p>
 <p class="norm">1. Directive on toys.</p></div>
</body></html>"""


def test_parses_both_renderings_into_the_same_structure():
    oj, cons = parse_act(OJ), parse_act(CONSOLIDATED)
    assert [p.provision_id for p in oj.provisions] == ["rct_1", "art_1", "art_2", "art_3", "anx_I"]
    assert [p.provision_id for p in cons.provisions] == ["art_1", "art_2", "art_2a", "art_3", "anx_I"]
    assert oj.chapters == cons.chapters == {"I": "GENERAL PROVISIONS"}
    art = cons.get("art_1")
    assert (art.title, art.chapter, art.chapter_title) == ("Subject matter", "I", "GENERAL PROVISIONS")
    assert oj.get("anx_I").title == cons.get("anx_I").title == "List of legislation"
    assert oj.get("rct_1").text == "The purpose of this Regulation is set out."


def test_text_is_verbatim_without_headings_or_footnote_numbers():
    oj, cons = parse_act(OJ), parse_act(CONSOLIDATED)
    assert oj.get("art_1").text.startswith("1. Providers shall comply")
    assert "12" not in oj.get("art_1").text and "(1)" not in cons.get("art_1").text
    assert oj.get("art_1").text_hash == cons.get("art_1").text_hash
    # A power keeps its exponent instead of running the digits together.
    assert "10^25" in oj.get("art_3").text and "10^25" in cons.get("art_3").text


def test_list_markers_join_their_item():
    assert parse_act(OJ).get("art_2").lines[1] == "(1) ‘provider’ means a person that develops an AI system;"


def test_markers_hold_until_the_next_one():
    cons = parse_act(CONSOLIDATED)
    assert cons.get("art_1").amendments == []
    assert cons.get("art_2").amendments == [{"act": "32026R1744", "action": "REPLACED"}]
    assert cons.get("art_2a").amendments == [{"act": "32026R1744", "action": "INSERTED"}]
    assert cons.get("art_3").amendments == []  # ▼B returned to the base act


def test_compare_names_what_changed():
    rows = {r["provision_id"]: r for r in compare(parse_act(OJ), parse_act(CONSOLIDATED))}
    assert rows["art_1"]["change"] == "unchanged"
    assert rows["art_2"]["change"] == "amended" and rows["art_2"]["acts"] == ["32026R1744"]
    assert rows["art_2a"]["change"] == "inserted"
    assert rows["art_3"]["change"] == "unchanged"
    assert "rct_1" not in rows  # recitals are not compared


def test_a_difference_without_a_marker_is_not_called_an_amendment():
    changed = OJ.replace("Above 10", "Strictly above 10")
    rows = {r["provision_id"]: r for r in compare(parse_act(CONSOLIDATED), parse_act(changed))}
    assert rows["art_3"]["change"] == "text_differs"


def test_definitions_keep_points_and_multi_line_definitions():
    found = definitions(parse_act(OJ).get("art_2"))
    assert [(d["point"], d["term"]) for d in found] == [("1", "provider"), ("2", "authority")]
    assert found[1]["definition"] == "\n(a) a public body;".strip()


def test_references_expand_ranges_and_skip_other_acts():
    text = "as referred to in Article 16, Articles 8 to 11 and Article 5 of Directive (EU) 2016/943; see Annex III and Annex I"
    assert article_references(text) == ["8", "9", "10", "11", "16"]
    assert annex_references(text) == ["I", "III"]


def test_text_hash_folds_white_space_and_quotes():
    assert text_hash("‘provider’  means\n x") == text_hash("'provider' means x")


def test_english_dates():
    assert english_date("shall apply from 2 August 2026.") == "2026-08-02"
    assert english_date("no date here") is None


def test_cellar_answer_and_links():
    answer = {"results": {"bindings": [
        {"celex": {"value": "32026R1744"},
         "relation": {"value": "http://publications.europa.eu/ontology/cdm#resource_legal_amends_resource_legal"},
         "date": {"value": "2026-07-08"}, "title": {"value": "Regulation (EU) 2026/1744"}},
        {"celex": {"value": "32024R1689R(01)"},
         "relation": {"value": "http://publications.europa.eu/ontology/cdm#resource_legal_corrects_resource_legal"},
         "date": {"value": "2025-10-09"}},
    ]}}
    rows = parse_related(answer)
    assert rows[0] == {"celex": "32026R1744", "relation": "amends", "date": "2026-07-08",
                       "title": "Regulation (EU) 2026/1744"}
    assert rows[1]["relation"] == "corrects" and rows[1]["title"] is None
    assert '"32024R1689"' in related_query("32024R1689") and "work_cites_work" not in related_query("x")
    assert eurlex_url("32024R1689") == "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689"


def test_ingest_fetches_the_act_its_versions_and_amending_acts():
    from ingest_cellar import wanted_texts

    rows = [{"celex": "02024R1689-20260727", "relation": "consolidates"},
            {"celex": "02013R0168-20260802", "relation": "consolidates"},  # another act's version
            {"celex": "32026R1744", "relation": "amends"},
            {"celex": "52025IP0198", "relation": "based_on"}]
    assert wanted_texts(rows) == [("32024R1689", "en"), ("32024R1689", "sv"),
                                  ("02024R1689-20260727", "en"), ("02024R1689-20260727", "sv"),
                                  ("32026R1744", "en")]


def test_versioned_raw_paths_keep_every_version():
    import rawstore

    assert rawstore.version_path("guidance/page.html", "ab" * 32) == "guidance/page@abababababab.html"
