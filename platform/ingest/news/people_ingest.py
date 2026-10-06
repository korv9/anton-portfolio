"""The politicians in office now, with their party, for tagging news by the people it names.

    python platform/ingest/news/people_ingest.py

News often names a minister or a party leader without the party: the Government's own press
releases write "Ebba Busch" and "socialminister Jakob Forssmed". Riksdagen's person list has
everyone who has sat in the Riksdag with their party and current role; this keeps those in
office now (members serving, ministers, the Speaker and deputy Speakers, members of the
European Parliament) and writes warehouse/raw/news/people.json:

    {"source_url": ..., "fetched_at": ..., "sha256": ..., "people": [
        {"name": "Ebba Busch", "party": "KD", "role": "Energi- och näringsminister"}, ...]}

Former members, the deceased and substitutes not serving are left out, so a name in the news
matches the person who holds office now.
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import RAW, session  # noqa: E402

URL = "https://data.riksdagen.se/personlista/?utformat=json&rdlstatus=samtliga&sz=10000"
OUT = RAW / "news" / "people.json"
PARTIES = {"S", "M", "SD", "V", "C", "KD", "MP", "L"}
LEFT_OUT = ("Tidigare", "Avliden", "Inga uppdrag", "Status saknas", "Tillgänglig ersättare")


def field(person: dict, key: str) -> str:
    """One field as text. A person listed twice comes back with every field as a list of the
    same values (Tobias Smedberg, October 2026); take the first."""
    value = person.get(key) or ""
    if isinstance(value, list):
        value = value[0] if value else ""
    return str(value).strip()


def in_office(person: dict) -> bool:
    status = field(person, "status")
    return bool(status) and not status.startswith(LEFT_OUT) and field(person, "parti") in PARTIES


def main() -> None:
    response = session().get(URL, timeout=180)
    response.raise_for_status()
    people = response.json()["personlista"]["person"]
    unique = {
        (f"{field(p, 'tilltalsnamn')} {field(p, 'efternamn')}", field(p, "parti")):
            field(p, "status") for p in people if in_office(p)}
    current = sorted(
        ({"name": name, "party": party, "role": role} for (name, party), role in unique.items()),
        key=lambda p: p["name"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source_url": URL,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(response.content).hexdigest(),
        "people": current,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    roles = sum(1 for p in current if not p["role"].startswith("Tjänstgörande"))
    print(f"people: {len(current)} in office ({roles} ministers, Speakers and others) "
          f"of {len(people)} in the list")


if __name__ == "__main__":
    main()
