"""platform/ingest/riksdagen/debate_corpus.py: passages, roles and reply targets."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest" / "riksdagen"))

from debate_corpus import (
    MAX_WORDS,
    build,
    committee,
    pack,
    role,
    search_text,
)


def speech(number, speaker, party, text, reply=False):
    return {"speech_id": f"HC09103-{number}", "session": "2024/25", "speech_date": "2025-04-23",
            "protocol_id": "HC09103", "debate_title": "Migrationsfrågor",
            "debate_kind": "ärendedebatt", "rel_dok_id": "HC01SfU18", "speech_number": number,
            "speaker": speaker, "party_raw": party, "is_reply": reply, "text": text,
            "source_url": f"https://data.riksdagen.se/anforande/HC09103-{number}/html"}


def test_pack_splits_between_sentences_and_keeps_negation():
    claim = "Vi vill inte skärpa kraven för anhöriginvandring. "
    text = "Fru talman!\n" + claim * 60
    out = pack(text)
    assert len(out) > 1
    assert all(p.rstrip().endswith(".") or p.endswith("!") for p in out)
    assert all("vill inte skärpa" in p for p in out)
    assert max(len(p.split()) for p in out) <= MAX_WORDS + 40


def test_pack_keeps_short_speech_whole_and_joins_short_tail():
    assert pack("Fru talman! Jag yrkar bifall.") == ["Fru talman! Jag yrkar bifall."]
    out = pack(("ord " * 150).strip() + "\n" + ("ord " * 100).strip() + "\nKort slut.")
    assert out[-1].endswith("Kort slut.") and len(out) == 2


def test_search_text_drops_only_the_chair_address():
    assert search_text("Fru talman! Jag tackar för svaret.") == "Jag tackar för svaret."
    assert search_text("Herr förste vice talman! Nej.") == "Nej."
    assert search_text("Talmannen har rätt.") == "Talmannen har rätt."


def test_role_and_committee():
    assert role("Statsrådet Johan Forssell (M)") == "government"
    assert role("Arbetsmarknads- och integrationsministern Johan Pehrson (L)") == "government"
    assert role("Statsministern Ulf Kristersson (M)") == "government"
    assert role("Ludvig Aspling (SD)") == "member"
    assert committee("HC01SfU18") == "SfU" and committee("HC01AU3") == "AU"
    assert committee(None) is None


def test_reply_targets_previous_other_speaker_and_chair_is_dropped():
    rows = [
        speech(1, "TALMANNEN", "TALMANNEN", "Ärendet debatteras."),
        speech(2, "Anna A (SD)", "SD", "Fru talman! Kraven måste skärpas. Det är nödvändigt."),
        speech(3, "Bo B (S)", "S", "Fru talman! Det stämmer inte. Vi säger nej.", reply=True),
        speech(4, "Anna A (SD)", "SD", "Fru talman! Jo, det stämmer.", reply=True),
    ]
    out, manifest = build(rows, {"topic": "test"})
    by_speech = {p["speech_id"]: p for p in out}
    assert "HC09103-1" not in by_speech
    assert by_speech["HC09103-2"]["responds_to"] is None
    assert by_speech["HC09103-3"]["responds_to"] == "HC09103-2"
    assert by_speech["HC09103-3"]["context"] == "Kraven måste skärpas."
    assert by_speech["HC09103-4"]["responds_to_party"] == "S"
    assert by_speech["HC09103-3"]["text"].startswith("Fru talman!")
    assert by_speech["HC09103-3"]["debate_id"] == "HC09103/1"
    assert manifest["debates"] == 1 and manifest["parties"]["SD"]["replies"] == 1
