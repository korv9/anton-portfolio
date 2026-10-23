"""Read a CV (PDF or DOCX) into a draft profile with a quoted CV line behind every fact.

    python platform/job_assistant/cv.py --cv frontend/public/cv/Anton_Ernstsson_CV_final.pdf --out tmp/profile-draft.json

The parser is rules only: section headings, "Title · Organisation Start - End" entry lines and the
skill taxonomy in skills.py. It never adds a fact the text does not contain; what it cannot place
goes to `uncertain` for the owner to correct before the profile is approved (cv_profile.py).
Contact details (e-mail, phone, personnummer, address) are cut out of each line and link-only lines
are dropped before parsing.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skills import SKILLS, best_level, find_skills  # noqa: E402

PARSER_VERSION = "cv-rules-v1"
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
HEADINGS = {
    "experience": r"professional experience|work experience|experience|arbetslivserfarenhet|yrkeserfarenhet|erfarenhet",
    "other_experience": r"additional experience|other experience|övrig erfarenhet|övriga erfarenheter",
    "skills": r"technical skills|skills|tekniska färdigheter|färdigheter|kompetenser",
    "education": r"education|utbildning|utbildningar",
    "projects": r"selected projects|projects|utvalda projekt|projekt",
    "languages": r"languages|språk",
}
MONTH = r"(?:[A-Za-zåäöÅÄÖ]{3,9}\.?\s+)?"
ENTRY = re.compile(
    r"^(?P<title>[^·|]+?)(?:\s*[·|]\s*|\s+[-–]\s+)(?P<org>.+?)\s+(?P<start>" + MONTH + r"\d{4})\s*[-–]\s*"
    r"(?P<end>" + MONTH + r"\d{4}|present|now|pågående|nu)$", re.I)
# E-mail, phone, Swedish personnummer (with a valid date), street address, and a postcode (100 00 to
# 999 99) before a town, with no word just before it. The same pattern as CONTACT in worker/jobs.ts.
CONTACT = re.compile(r"@|\+\d[\d ]{6,}|\b0\d{2}[- ]?\d{3} ?\d{2} ?\d{2}\b"
                     r"|\b(?:19|20)?\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[-+]?\d{4}\b"
                     r"|[^\W\d_]*(?:gatan|vägen|gränd|torget|allén|stigen) \d+"
                     r"|(?<![^\W_] )\b[1-9]\d{2} ?\d{2} [A-ZÅÄÖ][a-zåäö]+")
# What clean_lines cuts out of a CV line: a whole e-mail address, or any other CONTACT match.
CONTACT_SPAN = re.compile(r"\S*@\S*|" + CONTACT.pattern)
LINK = re.compile(r"(?:https?://)?(?:www\.)?[\w-]+(?:\.[\w-]+)*\.(?:com|se|io|dev|net|org|me)(?:/\S*)?", re.I)
NOISE = re.compile(r"^[•·\s]*$|^\S+\s+\d+\s*/\s*\d+$")
INTERNSHIP = re.compile(r"\blia\b|internship|praktik|\bintern\b|trainee", re.I)
THESIS = re.compile(r"thesis|examensarbete|uppsats", re.I)
LEVELS = (("doctorate", r"ph\.?d|doktor"), ("master", r"master|magister"),
          ("bachelor", r"bachelor|kandidat"), ("higher_vocational", r"\byh\b|yrkeshögskol|higher vocational"))
LANGUAGE = re.compile(r"(?P<language>[A-ZÅÄÖ][a-zåäö]+)\s*\((?P<proficiency>[^)]+)\)")


def read_text(data: bytes, media_type: str) -> str:
    """Plain text of a PDF or DOCX file, one line per text line or paragraph."""
    if media_type == PDF or data[:5] == b"%PDF-":
        from pypdf import PdfReader
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages)
    if media_type == DOCX or data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as docx:
            root = ElementTree.fromstring(docx.read("word/document.xml"))
        w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        return "\n".join("".join(t.text or "" for t in p.iter(w + "t")) for p in root.iter(w + "p"))
    raise ValueError("CV must be a PDF or DOCX file")


def clean_lines(text: str) -> list[str]:
    """CV lines without contact details: the contact span goes, the rest of its line stays."""
    lines = [re.sub(r"\s+", " ", CONTACT_SPAN.sub(" ", line)).strip(" /·|,")
             for line in text.replace("•", " ").splitlines()]
    return [line for line in lines if line and not NOISE.match(line) and LINK.sub("", line).strip(" /·|,")]


def sections(lines: list[str]) -> dict[str, list[str]]:
    """Lines grouped under the known headings; lines before the first heading are the summary."""
    out: dict[str, list[str]] = {"summary": []}
    current = "summary"
    for line in lines:
        name = next((k for k, p in HEADINGS.items() if re.fullmatch(p, line, re.I)), None)
        if name:
            current = name
            out.setdefault(name, [])
        else:
            out.setdefault(current, []).append(line)
    return out


def sentences(lines: list[str]) -> list[str]:
    """Wrapped PDF lines joined back into sentences, so a quote is a whole sentence."""
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", " ".join(lines)) if s.strip()]


def entries(lines: list[str]) -> list[dict]:
    """Split a section at its "Title · Organisation Start - End" lines."""
    found: list[dict] = []
    for line in lines:
        m = ENTRY.match(line)
        if m:
            found.append({**{k: v.strip() for k, v in m.groupdict().items()}, "header": line, "lines": []})
        elif found:
            found[-1]["lines"].append(line)
    return found


def experience(name: str, lines: list[str]) -> list[dict]:
    out = []
    for e in entries(lines):
        # The title (Praktikant, LIA) or the first line under it names an internship.
        kind = "internship" if INTERNSHIP.search(" ".join([e["title"], *e["lines"][:1]])) else "employment"
        body = sentences(e["lines"])
        out.append({"id": f"{name}-{len(out) + 1}", "kind": kind, "title": e["title"], "organisation": e["org"],
                    "start": e["start"], "end": e["end"], "quote": e["header"], "details": body,
                    "skills": sorted({s for s, _ in find_skills(" ".join([e["header"], *e["lines"]]))})})
    return out


def projects(lines: list[str]) -> list[dict]:
    """Blocks that end at a "Tech:" line. A project's name is its first line without a full stop."""
    blocks, current = [], []
    for line in lines:
        current.append(line)
        if re.match(r"(?:tech|teknik|tekniker)\s*:", line, re.I):
            blocks.append(current)
            current = []
    out = []
    for block in blocks:
        name = next((line for line in block if not line.endswith(".")), block[0])
        name = re.sub(r"\s+(?:personal project|eget projekt|(?:spring|autumn|fall|vår|höst)\s+\d{4})$", "", name, flags=re.I)
        text = " ".join(block)
        out.append({"id": f"project-{len(out) + 1}", "name": name,
                    "context": "education" if THESIS.search(text) else "personal",
                    "quote": block[0], "details": sentences(block),
                    "skills": sorted({s for s, _ in find_skills(text)})})
    return out


def education(lines: list[str]) -> list[dict]:
    out = []
    for e in entries(lines):
        text = " ".join([e["header"], *e["lines"]])
        credits = re.search(r"(\d+)\s*(?:yh|hp|ects|högskolepoäng)?[ -]*(?:credits|poäng|hp|ects)", text, re.I)
        done = re.search(r"(?:graduated|completed|examen|examinerad)\s+(" + MONTH + r"\d{4})", text, re.I)
        out.append({"id": f"education-{len(out) + 1}", "programme": e["title"], "institution": e["org"],
                    "level": next((lv for lv, p in LEVELS if re.search(p, text, re.I)), None),
                    "credits": int(credits.group(1)) if credits else None,
                    "start": e["start"], "end": e["end"], "completed": done.group(1) if done else None,
                    "quote": e["header"], "details": sentences(e["lines"]),
                    "skills": sorted({s for s, _ in find_skills(text)})})
    return out


def skill_evidence(exp: list[dict], proj: list[dict], edu: list[dict], listed: list[str],
                   summary: list[str]) -> list[dict]:
    """Each taxonomy skill with every CV line that names it, labelled by where that line sits."""
    evidence: dict[str, list[dict]] = {}

    def add(level: str, ref: str, texts: list[str]):
        for text in texts:
            for skill, _ in find_skills(text):
                rows = evidence.setdefault(skill, [])
                if not any(r["ref"] == ref and r["quote"] == text for r in rows):
                    rows.append({"level": level, "ref": ref, "quote": text})

    for e in exp:
        add("practical", e["id"], [e["quote"], *e["details"]])
    for p in proj:
        add("education_or_project", p["id"], p["details"])
    for e in edu:
        add("education_or_project", e["id"], [e["quote"], *e["details"]])
    add("listed", "skills", listed)
    add("listed", "summary", summary)
    return [{"skill": s, "category": SKILLS[s][0], "level": best_level(rows), "evidence": rows}
            for s, rows in sorted(evidence.items(), key=lambda kv: kv[0].casefold())]


def parse(data: bytes, media_type: str, filename: str, now: datetime | None = None) -> dict:
    text = read_text(data, media_type)
    parts = sections(clean_lines(text))
    exp = experience("experience", parts.get("experience", [])) + experience("other", parts.get("other_experience", []))
    summary = [LINK.sub("", line).strip() for line in parts.get("summary", [])]
    proj, edu = projects(parts.get("projects", [])), education(parts.get("education", []))
    languages = [{"language": m["language"], "proficiency": m["proficiency"], "quote": m.group()}
                 for m in LANGUAGE.finditer(" ".join(parts.get("languages", [])))]
    uncertain = [f"No {name} section was found." for name in ("experience", "education", "skills")
                 if not parts.get(name)]
    uncertain += [f"Line under {name} not read as an entry: {line}" for name in ("experience", "education")
                  for line in parts.get(name, [])[:1] if not ENTRY.match(line)]
    return {
        "schema_version": 1,
        "status": "draft",
        "cv": {"sha256": hashlib.sha256(data).hexdigest(), "filename": filename, "media_type": media_type,
               "parser": PARSER_VERSION, "parsed_at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
               "text_sha256": hashlib.sha256(text.encode()).hexdigest()},
        "summary": " ".join(summary),
        "experience": exp,
        "projects": proj,
        "education": edu,
        "skills": skill_evidence(exp, proj, edu, parts.get("skills", []), sentences(summary)),
        "languages": languages,
        "professional_years": None,
        "wishes": {"locations": [], "remote": None, "roles": [], "interests": []},
        "uncertain": uncertain,
        "corrections": [],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cv", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    media = PDF if args.cv.suffix.lower() == ".pdf" else DOCX
    profile = parse(args.cv.read_bytes(), media, args.cv.name)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(profile, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{args.out}: {len(profile['experience'])} experience, {len(profile['projects'])} projects, "
          f"{len(profile['skills'])} skills, {len(profile['uncertain'])} uncertain")


if __name__ == "__main__":
    main()
