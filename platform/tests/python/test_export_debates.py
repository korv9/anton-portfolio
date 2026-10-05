"""The debate statistics: continuation titles, who replies to whom, and word matches."""
import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "export_debates", Path(__file__).resolve().parents[2] / "publish/export_debates.py")
debates = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(debates)


def speech(n, speaker, party, reply):
    return {"speech_number": n, "speaker": speaker, "party": party, "is_reply": reply}


def test_continuations_are_the_same_debate():
    title = "(forts. från § 13) En lag om public service (forts. KrU2)"
    assert debates.clean_title(title) == "en lag om public service"
    assert debates.clean_title("  En lag  om public service ") == "en lag om public service"


def test_replies_go_to_the_main_speaker_and_answers_back():
    rows = [
        speech(1, "Anna", "S", False),
        speech(2, "Bo", "M", True),   # Bo replies to Anna
        speech(3, "Anna", "S", True),  # Anna answers Bo
        speech(4, "Cia", "V", True),   # Cia replies to Anna
        speech(5, "Anna", "S", True),  # Anna answers Cia
        speech(6, "Bo", "M", False),   # a new speech
        speech(7, "Anna", "S", True),  # Anna replies to Bo
    ]
    pairs, matrix = debates.exchanges(rows)
    assert pairs == [["M", "S"], ["S", "M"], ["V", "S"], ["S", "V"], ["S", "M"]]
    assert matrix["S"] == {"M": 2, "V": 1}


def test_word_matches_need_the_keyword_or_a_short_ending():
    assert debates.matches("polisen", "polis")
    assert debates.matches("skola", "skola")
    assert not debates.matches("polisutbildningsreformen", "polis")
    words = {"rattsvasende": ["polis"], "utbildning": ["skola"]}
    assert debates.areas_from_words("Polisen och skolan", words) == ["rattsvasende", "utbildning"]
