"""Check, correct and approve a CV profile (schema v1, written by cv.py).

    python platform/job_assistant/cv_profile.py check --profile draft.json --cv cv.pdf
    python platform/job_assistant/cv_profile.py approve --profile draft.json --cv cv.pdf --versions dir/

The owner corrects a draft before it is used. A correction may move, rename or remove CV facts and
may add wishes and interests, but every quote at a level above `interest` must still be found in
the CV text: a correction cannot create experience the CV does not state. Approval freezes the
draft as the next numbered version (dir/v<N>.json); matches record that version and the CV hash.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cv import CONTACT, DOCX, LINK, PDF, clean_lines, read_text, sections  # noqa: E402
from skills import LEVELS, SKILLS, best_level  # noqa: E402

KEYS = {"schema_version", "status", "cv", "summary", "experience", "projects", "education", "skills",
        "languages", "professional_years", "wishes", "uncertain", "corrections"}
APPROVED_KEYS = KEYS | {"version", "approved_at", "profile_sha256"}
WISH_KEYS = {"locations", "remote", "roles", "interests"}
ROLES = ("data_engineering", "analytics_engineering", "python_backend", "applied_ai", "bi", "frontend",
         "fullstack", "data_analysis", "ml_engineering", "other")
# An evidence ref names the CV section its quote must sit in, and that section fixes the level:
# a skills-list or summary line stays `listed` whatever experience sentence it is paired with.
REFS = {"experience": ("experience", "practical"), "other": ("other_experience", "practical"),
        "project": ("projects", "education_or_project"), "education": ("education", "education_or_project"),
        "skills": ("skills", "listed"), "summary": ("summary", "listed")}


def fold(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def problems(profile: dict, cv_text: str | None = None) -> list[str]:
    """Every reason the profile cannot be used; empty when it is valid."""
    out = []
    keys = set(profile)
    allowed = APPROVED_KEYS if profile.get("status") == "approved" else KEYS
    if not KEYS <= keys or not keys <= allowed:
        return [f"fields differ from schema v1: missing {sorted(KEYS - keys)}, unexpected {sorted(keys - allowed)}"]
    if profile["schema_version"] != 1 or profile["status"] not in ("draft", "approved"):
        out.append("schema_version must be 1 and status draft or approved")
    if not re.fullmatch(r"[0-9a-f]{64}", str(profile["cv"].get("sha256", ""))):
        out.append("cv.sha256 is not a SHA-256 hex digest")
    if CONTACT.search(json.dumps(profile, ensure_ascii=False)):
        out.append("profile contains contact details (e-mail, phone, personnummer or address)")
    lines = clean_lines(cv_text) if cv_text is not None else None
    parts = sections(lines) if lines is not None else {}

    def text(lines: list[str]) -> tuple[str, str]:
        # The summary drops link words inside lines, so a quote may match either form of the text.
        return fold(" ".join(lines)), fold(" ".join(LINK.sub("", line) for line in lines))

    def quoted(where: str, quote: object, section: str | None = None):
        if not isinstance(quote, str) or not quote.strip():
            out.append(f"{where}: quote is missing")
        elif lines is not None and not any(fold(quote) in s for s in text(parts.get(section, []) if section else lines)):
            out.append(f"{where}: quote is not in the CV {section or 'text'}: {quote[:80]}")

    for section in ("experience", "projects", "education"):
        for item in profile[section]:
            quoted(f"{section}/{item.get('id')}", item.get("quote"))
            for i, line in enumerate(item.get("details", [])):
                quoted(f"{section}/{item.get('id')}/details/{i}", line)
    for lang in profile["languages"]:
        quoted(f"languages/{lang.get('language')}", lang.get("quote"))
    for s in profile["skills"]:
        where = f"skills/{s.get('skill')}"
        if s.get("skill") not in SKILLS:
            out.append(f"{where}: not in the skill taxonomy")
        rows = s.get("evidence") or []
        if not rows or any(r.get("level") not in LEVELS[:3] for r in rows):
            out.append(f"{where}: needs CV evidence rows at practical, education_or_project or listed level")
            continue
        if s.get("level") != best_level(rows):
            out.append(f"{where}: level {s.get('level')} differs from its strongest evidence {best_level(rows)}")
        for r in rows:
            section, level = REFS.get(re.sub(r"-\d+$", "", str(r.get("ref"))), (None, None))
            if section is None or r["level"] != level:
                out.append(f"{where}/{r.get('ref')}: level {r['level']} does not match the CV section of its ref")
            quoted(f"{where}/{r.get('ref')}", r.get("quote"), section)
    wishes = profile["wishes"]
    if set(wishes) != WISH_KEYS:
        out.append(f"wishes must have exactly {sorted(WISH_KEYS)}")
    else:
        out += [f"wishes/roles: unknown role {r}" for r in wishes["roles"] if r not in ROLES]
        out += [f"wishes/interests: {i} is not in the skill taxonomy" for i in wishes["interests"] if i not in SKILLS]
        if wishes["remote"] not in (None, "no", "hybrid", "remote"):
            out.append("wishes/remote must be null, no, hybrid or remote")
    years = profile["professional_years"]
    if years is not None and not (isinstance(years, (int, float)) and 0 <= years <= 60):
        out.append("professional_years must be null or a documented number")
    return out


def correct(profile: dict, changes: dict, note: str, now: datetime | None = None) -> dict:
    """A new draft with top-level fields replaced and the change logged; `cv` cannot be changed."""
    if "cv" in changes or not set(changes) <= KEYS - {"schema_version", "status", "corrections"}:
        raise ValueError(f"cannot correct {sorted(set(changes))}")
    out = copy.deepcopy(profile)
    for key in ("version", "approved_at", "profile_sha256"):
        out.pop(key, None)
    out.update(copy.deepcopy(changes))
    out["status"] = "draft"
    at = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    out["corrections"].append({"at": at, "fields": sorted(changes), "note": note})
    return out


def digest(profile: dict, skip: tuple[str, ...] = ("approved_at", "profile_sha256")) -> str:
    body = {k: v for k, v in profile.items() if k not in skip}
    return hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def approve(profile: dict, cv_text: str, versions: list[dict], now: datetime | None = None) -> dict:
    """The draft frozen as the next version. Refuses an invalid draft or one that matches the last version."""
    found = problems(profile, cv_text)
    if found:
        raise ValueError("profile is not valid: " + "; ".join(found[:5]))
    out = copy.deepcopy(profile)
    out.update(status="approved", version=max((v["version"] for v in versions), default=0) + 1)
    out["profile_sha256"] = digest(out)
    if versions:
        last = max(versions, key=lambda v: v["version"])
        # The correction log grows with every edit, so it does not count as a change.
        same = ("approved_at", "profile_sha256", "corrections")
        if digest({**last, "version": out["version"]}, same) == digest(out, same):
            raise ValueError(f"profile is unchanged since version {last['version']}")
    out["approved_at"] = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("action", choices=["check", "approve"])
    ap.add_argument("--profile", required=True, type=Path)
    ap.add_argument("--cv", required=True, type=Path)
    ap.add_argument("--versions", type=Path, help="folder of approved v<N>.json files (approve)")
    args = ap.parse_args()
    profile = json.loads(args.profile.read_text(encoding="utf-8"))
    text = read_text(args.cv.read_bytes(), PDF if args.cv.suffix.lower() == ".pdf" else DOCX)
    if hashlib.sha256(args.cv.read_bytes()).hexdigest() != profile["cv"]["sha256"]:
        sys.exit("the profile was parsed from another CV file")
    if args.action == "check":
        found = problems(profile, text)
        print("\n".join(found) or "valid")
        sys.exit(1 if found else 0)
    if not args.versions:
        sys.exit("approve needs --versions")
    args.versions.mkdir(parents=True, exist_ok=True)
    versions = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(args.versions.glob("v*.json"))]
    approved = approve(profile, text, versions)
    path = args.versions / f"v{approved['version']}.json"
    path.write_text(json.dumps(approved, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"approved {path}")


if __name__ == "__main__":
    main()
