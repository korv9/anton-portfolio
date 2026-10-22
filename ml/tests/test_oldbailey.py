"""Old Bailey extraction: gold labels, keyword rules, answer parsing and paired scores."""
import xml.etree.ElementTree as ET

import pandas as pd

from ml.oldbailey.extract import parse
from ml.oldbailey.rules import keyword
from ml.oldbailey.score import field_scores
from ml.oldbailey.trials import model_text, trial

TRIAL = """<div1 type="trialAccount" id="t17500117-1">
<join result="criminalCharge" targets="d1 o1 v1"/>
<p><persName id="d1" type="defendantName">John Bowen</persName>, was indicted for
<rs id="o1" type="offenceDescription"><interp inst="o1" type="offenceCategory" value="theft"/>stealing a cap</rs>.
<rs id="v1" type="verdictDescription"><interp inst="v1" type="verdictCategory" value="{verdict}"/>{word}</rs>.
{punishment}</p></div1>"""
SENTENCE = '<rs id="p1" type="punishmentDescription"><interp inst="p1" type="punishmentCategory" value="transport"/>T.</rs>'
MAJORITY = {"offence": "theft", "verdict": "guilty", "punishment": "imprison"}


def test_gold_labels_and_left_out_trials():
    guilty = ET.fromstring(TRIAL.format(verdict="guilty", word="Guilty", punishment=SENTENCE))
    assert trial(guilty) == ({"offence": "theft", "verdict": "guilty", "punishment": "transport"}, "eligible")
    acquitted = ET.fromstring(TRIAL.format(verdict="notGuilty", word="Acquitted", punishment=""))
    assert trial(acquitted)[0]["punishment"] == "none"
    # A guilty trial whose sentence was printed elsewhere is kept, but its punishment is not scored.
    elsewhere = ET.fromstring(TRIAL.format(verdict="guilty", word="Guilty", punishment=""))
    assert trial(elsewhere)[0]["punishment"] is None
    two = ET.fromstring(TRIAL.format(verdict="guilty", word="Guilty", punishment="").replace(
        "</p>", '<persName id="d2" type="defendantName">Ann Bowen</persName></p>'))
    assert trial(two) == (None, "several_defendants_or_charges")
    text, words = model_text(guilty)
    assert text.startswith("John Bowen , was indicted") and words == len(text.split())


def test_keyword_rules():
    assert keyword("Mary Smith was indicted for stealing a cap. Not Guilty .", MAJORITY) == {
        "offence": "theft", "verdict": "notGuilty", "punishment": "none"}
    assert keyword("John Jones was indicted for robbing him on the highway. Guilty . T .", MAJORITY) == {
        "offence": "violentTheft", "verdict": "guilty", "punishment": "transport"}
    assert keyword("Ann Lee , Feloniously forging a cheque. GUILTY . Five Years' Penal Servitude.",
                   MAJORITY)["punishment"] == "imprison"


def test_parse_answers():
    assert parse('```json\n{"offence": "kill", "verdict": "guilty", "punishment": "death"}\n```') == {
        "offence": "kill", "verdict": "guilty", "punishment": "death"}
    assert parse('{"offence": "burglary", "verdict": "guilty"}') == {
        "offence": None, "verdict": "guilty", "punishment": None}
    assert parse("no json") == {"offence": None, "verdict": None, "punishment": None}


def test_paired_scores():
    gold = pd.Series(["a", "a", "b", "b", None])
    scores = field_scores(gold, {"gemma": pd.Series(["a", "a", "b", "b", "a"]),
                                 "keyword": pd.Series(["a", "b", "a", "b", "a"])})
    assert scores["n"] == 4
    assert scores["methods"]["gemma"]["accuracy"] == 1.0 and scores["methods"]["keyword"]["accuracy"] == 0.5
    assert scores["gemma_minus_keyword"]["accuracy"] == 0.5
