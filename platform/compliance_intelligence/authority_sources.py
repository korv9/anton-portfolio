"""Public HTML adapters. Output is source observations, never legal conclusions."""
from __future__ import annotations

import io
import re
from datetime import date
from html.parser import HTMLParser
from importlib.metadata import version
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit, urlunsplit

from lib.rawstore import sha256
from compliance_intelligence.registry import organization_number

SOURCES = {
    "imy": {
        "authority": "Integritetsskyddsmyndigheten",
        "origin": "https://www.imy.se",
        "seed": "https://www.imy.se/om-oss/beslut-publikationer-och-remisser/beslut-om-sanktionsavgift/",
        "terms": "https://www.imy.se/om-oss/vart-uppdrag/vidareutnyttjande-av-data/",
        "scope": "Published sanction index; linked records may contain non-GDPR or appeal material; unclassified until review",
    },
    "kkv": {
        "authority": "Konkurrensverket",
        "origin": "https://www.konkurrensverket.se",
        "seed": "https://www.konkurrensverket.se/konkurrens/tillsyn-arenden-och-beslut/arendelista",
        "terms": "https://www.konkurrensverket.se/om-oss/om-webbplatsen/anvanda-och-lanka-till-vart-material/",
        "scope": "Selected published competition cases; includes investigations, closures and court documents",
    },
}
# Independent publication hosts are supplements, not authority list adapters.
DOCUMENT_SOURCES = {
    "court_publications": {
        "authority": "Sveriges Domstolar",
        "origin": "https://www.domstol.se",
        "terms": "https://www.domstol.se/om-webbplatsen-och-digitala-kanaler/oppna-data/",
    },
    "court_precedents": {
        "authority": "Domstolsverket",
        "origin": "https://rattspraxis.etjanst.domstol.se",
        "terms": "https://www.domstol.se/om-webbplatsen-och-digitala-kanaler/oppna-data/",
    },
}


def source_spec(source):
    return SOURCES[source] if source in SOURCES else DOCUMENT_SOURCES[source]


# Parser code and dependency versions invalidate cached extractions automatically.
EXTRACTION_VERSION = "authority-observations-v1:" + sha256(
    Path(__file__).read_bytes() + Path(__file__).with_name("registry.py").read_bytes() + version("pypdf").encode()
)[:20]
CASE_REFERENCE = r"\bIMY[-–]\d{4}[-–]\d+\b|\bDI[-–]\d{4}[-–]\d+\b|\b(?:dnr|diarienummer)\s*:?\s*(\d{1,6}/\d{4})"


class ExtractionFailure(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def official_url(source, url):
    p = urlsplit(url)
    if (p.scheme != "https" or p.netloc != urlsplit(source_spec(source)["origin"]).netloc
            or p.username or p.password or p.port not in (None, 443)):
        raise ValueError("URL is outside the official source origin")
    if any(c in url for c in ("\r", "\n", "\\")):
        raise ValueError("Invalid URL")
    return urlunsplit((p.scheme, p.netloc, p.path or "/", p.query, ""))


class Node:
    def __init__(self, tag="root", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.walk()

    def text(self):
        if self.tag in ("script", "style", "nav", "footer", "header", "aside"):
            return ""
        return " ".join(" ".join(c.text() if isinstance(c, Node) else c for c in self.children).split())


class Page(HTMLParser):
    def __init__(self, data):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(data.decode("utf-8-sig", errors="replace"))

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in ("area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"):
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


MONTHS = "januari februari mars april maj juni juli augusti september oktober november december".split()
DATE = r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:" + "|".join(MONTHS) + r")\s+\d{4})"


def parsed_date(value):
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return date.fromisoformat(value).isoformat()
        d, m, y = value.lower().split()
        return date(int(y), MONTHS.index(m) + 1, int(d)).isoformat()
    except (ValueError, TypeError):
        return None


def single(values):
    values = {v for v in values if v is not None}
    return next(iter(values)) if len(values) == 1 else None


def observations(sections, metadata=None):
    """Every extracted value retains its locator; conflicting dates stay null."""
    evidence, names, numbers, refs, markers = [], [], [], [], []
    for locator, text in sections:
        for field, label in (("decision_date", r"(?:Beslutsdatum|Datum för beslut|Beslut den)"),
                             ("publication_date", r"(?:Publicerad|Publiceringsdatum|Publicerat)")):
            for m in re.finditer(label + r"\s*:?\s*(" + DATE + r")", text, re.I):
                value = parsed_date(m[1])
                if value:
                    evidence.append({"field": field, "value": value, "locator": locator, "quote": m[0]})
        for m in re.finditer(CASE_REFERENCE, text, re.I):
            refs.append({"value": m[1] or m[0], "locator": locator})
        for m in re.finditer(r"\b(?:16)?\d{6}[- ]?\d{4}\b", text):
            try:
                numbers.append({"organization_number": organization_number(m[0].replace(" ", "")), "locator": locator})
            except ValueError:
                pass  # Natural-person and malformed numbers never become company candidates.
        # A literal legal suffix is a candidate mention, not a verified operator or party role.
        name_text = re.sub(CASE_REFERENCE, "\n", text, flags=re.I)
        for m in re.finditer(r"(?<!\w)([A-ZÅÄÖ][\wÅÄÖåäö&'.–-]*(?:[ \t]+[A-ZÅÄÖ0-9][\wÅÄÖåäö&'.–-]*){0,7}[ \t]+(?:AB|Aktiebolag|A/S|Ltd|GmbH))\b", name_text):
            names.append({"name": m[1], "locator": locator})
        for m in re.finditer(r"rättelse|rättat|korrigerad|ersätter|ersatts|upphävt|superseded|corrected", text, re.I):
            markers.append({"marker": m[0], "locator": locator})
    for key, values in (metadata or {}).items():
        if key.lower() in ("article:published_time", "datepublished"):
            for value in values:
                # Only explicitly labelled publication metadata; modified dates are separate.
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T.*)?", value):
                    evidence.append({"field": "publication_date", "value": parsed_date(value[:10]),
                                     "locator": "meta:" + key, "quote": value})
    references = sorted({r["value"] for r in refs})
    return {"publication_date": single(e["value"] for e in evidence if e["field"] == "publication_date"),
            "decision_date": single(e["value"] for e in evidence if e["field"] == "decision_date"),
            "case_reference": single(references), "case_references": refs, "field_evidence": evidence,
            "named_legal_entities": names, "organization_numbers": numbers,
            "revision_markers": markers, "decision_status": None, "appeal_status": None,
            "finality_status": None, "sanction_amount": None, "legal_basis": None,
            "review_status": "unreviewed"}


def extract(source, url, content, content_type, kind):
    links, metadata, sections, limitations, revision_links = [], {}, [], [], []
    decision_header = None
    if "pdf" in content_type or content.startswith(b"%PDF-"):
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise ExtractionFailure("encrypted_document", "Encrypted document; no password or restriction bypass")
        sections = [("page:" + str(i + 1), p.extract_text() or "") for i, p in enumerate(reader.pages)]
        if not any(t.strip() for _, t in sections):
            limitations.append("no_extractable_text_ocr_not_run")
        metadata = {str(k): [str(v)] for k, v in (reader.metadata or {}).items()}
        # IMY decision template verified on 2026-10-17: first-page docket and Datum.
        # Never use this generic label on correspondence, court attachments or HTML.
        if (source == "imy" and "/dokument/beslut/" in urlsplit(url).path and sections
                and "Integritetsskyddsmyndighetens beslut" in sections[0][1]):
            dates = list(re.finditer(r"\bDatum\s*:\s*(" + DATE + r")", sections[0][1], re.I))
            if len(dates) == 1 and parsed_date(dates[0][1]):
                decision_header = {"field": "decision_date", "value": parsed_date(dates[0][1]),
                                   "locator": "page:1; header:Datum", "quote": dates[0][0]}
    elif "html" in content_type:
        page = Page(content)
        main = next((n for n in page.root.walk() if n.tag == "main"), None)
        if main is None:
            raise ExtractionFailure("main_content_missing", "Expected main content missing; possible source layout change")
        sections = [("main", main.text())]
        metadata = {}
        metadata["source_updated_dates"] = re.findall(r"Senast uppdaterad\s*:?\s*(" + DATE + r")", main.text(), re.I)
        for n in page.root.walk():
            if n.tag == "meta" and (n.attrs.get("name") or n.attrs.get("property")):
                key = n.attrs.get("name") or n.attrs["property"]
                # Do not retain CSP nonces, trackers or arbitrary headers as source metadata.
                if key.lower() in ("description", "keywords", "og:title", "article:published_time", "article:modified_time", "datepublished"):
                    metadata.setdefault(key, []).append(n.attrs.get("content", ""))
        title = next((n.text() for n in main.walk() if n.tag == "h1"), None)
        metadata["title"] = [title] if title else []
        candidates = list(main.walk())
        if source == "imy" and kind == "listing":
            body = next((n for n in candidates if "imy-contentpage__main-content" in n.attrs.get("class", "")), None)
            if body is None:
                raise ExtractionFailure("sanction_index_layout_missing", "Sanction index content missing")
            # Only direct year sections; side menus and other supervision lists are excluded.
            active, candidates = False, []
            for n in body.children:
                if isinstance(n, Node):
                    if n.tag == "h2" and re.fullmatch(r"20\d{2}", n.attrs.get("id", "")):
                        active = True
                    if active:
                        candidates.extend(n.walk())
        for n in candidates:
            if n.tag != "a" or not n.attrs.get("href") or "nofollow" in n.attrs.get("rel", ""):
                continue
            try:
                target = official_url(source, urljoin(url, n.attrs["href"]))
            except ValueError:
                continue
            path = urlsplit(target).path.lower()
            link_kind = None
            if kind == "listing":
                if source == "imy" and (path.startswith("/link/") or path.startswith("/tillsyner/")):
                    link_kind = "record"
                elif source == "kkv" and "/arendelista/" in path and target.rstrip("/") != url.split("?")[0].rstrip("/"):
                    link_kind = "record"
                # Follow published pagination only. Never call the site's private search API.
                if "next" in n.attrs.get("rel", "") or "page" in parse_qs(urlsplit(target).query):
                    if urlsplit(target).path.rstrip("/") == urlsplit(url).path.rstrip("/"):
                        current = int(parse_qs(urlsplit(url).query).get("page", ["0"])[0])
                        pages = parse_qs(urlsplit(target).query).get("page", [])
                        if pages and pages[0].isdigit() and int(pages[0]) > current:
                            link_kind = "listing"
            elif path.endswith(".pdf") or (source == "imy" and path.startswith("/link/")):
                link_kind = "document"
            if link_kind:
                links.append({"url": target, "kind": link_kind, "label": n.text()})
                if re.search(r"rätt|korriger|ersätt|ersatt|supersed|correct", n.text(), re.I):
                    revision_links.append({"target_url": target, "source_label": n.text(),
                                           "locator": "main;a[href=" + n.attrs["href"] + "]",
                                           "relationship_status": "candidate_requires_review"})
        if kind == "listing" and not any(l["kind"] == "record" for l in links):
            raise ExtractionFailure("listing_records_missing", "No records discovered; layout or access must be checked")
        if source == "kkv" and kind == "listing":
            match = re.search(r"Visar\s+sökresultat\s+(\d+)\s*[-–]\s*(\d+)\s+av\s+(\d+)", main.text(), re.I)
            if not match:
                limitations.append("pagination_terminal_not_verified")
            elif int(match[2]) < int(match[3]) and not any(l["kind"] == "listing" for l in links):
                limitations.append("pagination_links_missing")
    else:
        raise ExtractionFailure("unsupported_content_type", "Unsupported document content type")
    # Deduplicate URLs without losing discovery order or page-level provenance.
    links = list({(l["url"], l["kind"]): l for l in links}.values())
    result = observations(sections, metadata) if kind != "listing" else observations([])
    if decision_header:
        result["field_evidence"].append(decision_header)
        result["decision_date"] = single(e["value"] for e in result["field_evidence"] if e["field"] == "decision_date")
    return {**result, "source_metadata": metadata, "links": links, "limitations": limitations,
            "revision_link_candidates": revision_links, "kind": kind, "extraction_version": EXTRACTION_VERSION}
