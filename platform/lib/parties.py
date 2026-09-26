"""One spelling per party.

Source exports carry the party field as the protocol wrote it, which means the same party
appears under several labels and the chair appears as if it were a party:

  FP / L      Folkpartiet was renamed Liberalerna in 2015; both spellings occur, and in
              sessions spanning the change both occur at once
  KDS / KD    Kristdemokratiska Samhällspartiet became Kristdemokraterna in 1996
  s / S       older protocols are inconsistently cased
  TALMANNEN   the Speaker and deputy Speakers chair the sitting; their interventions are
              procedural, not party speech

Left unresolved this splits a party into two classes. Any measure that balances across
parties then collapses to the smaller half: one session with 5,576 speeches yielded 351
usable passages because 39 of them said L while 555 said FP.

Historical parties that genuinely existed, such as NYD, are kept. This normalises spelling,
never political identity.
"""
from __future__ import annotations

import re

# Renames, not mergers of distinct parties.
RENAMED = {"FP": "L", "KDS": "KD"}

# Parties with seats in the Riksdag during the covered period.
KNOWN = {"C", "KD", "L", "M", "MP", "S", "SD", "V", "NYD"}

# The chair speaks in role, not for a party. Matched on a stem because some exports carry
# damaged characters in "FÖRSTE VICE TALMANNEN".
CHAIR = re.compile(r"TALMAN", re.IGNORECASE)


def normalise(party: str | None) -> str:
    """Canonical party code, or an empty string when the speaker has no party in this role."""
    value = (party or "").strip().upper()
    if not value or value == "-" or CHAIR.search(value):
        return ""
    value = RENAMED.get(value, value)
    return value if value in KNOWN else ""


def is_party(party: str | None) -> bool:
    return normalise(party) != ""
