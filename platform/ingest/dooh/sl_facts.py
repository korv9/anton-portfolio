"""Fetch Region Stockholm's "Fakta om SL och länet" (2013–2022) and read the metro boardings.

Each edition has a metro map with boardings per station on an average winter weekday ("påstigande
per dygn en genomsnittlig vintervardag", counted by hand). The 2013–2020 editions also have a
table appendix with each station's boardings 06.00–09.00, 07.30–08.30, 15.00–18.00 and
16.30–17.30. The series ended with the 2022 edition: Region Stockholm writes that "Fakta om SL och
länet" will be replaced by a statistics service, so later years are absent here.

The 2019–2022 editions are fetched from regionstockholm.se. The 2013–2018 editions are no longer on
sll.se; they are fetched from the Internet Archive's copies of the sll.se files (the `id_` form
returns the archived bytes unchanged), and each row names the original URL.

Writes warehouse/raw/sl_facts/: pdf/<year>.pdf as fetched (provenance in the fetch log) and
parsed/<year>.json, what this file read from it: the PDF's SHA-256, the pages, the day value per
station on the map, and the appendix bands per station and line where the edition has them. The
PDFs carry no open licence, so they stay on the machine (LOCAL_ONLY in warehouse_store.py); the
parsed figures are stored.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

import pymupdf

from portfolio.core.io import write_json
from portfolio.storage import rawstore
from portfolio.storage.rawstore import fetch, session

SOURCE = "sl_facts"
ARCHIVE = "https://web.archive.org/web/{stamp}id_/https://www.sll.se/globalassets/2.-kollektivtrafik/fakta-om-sl-och-lanet/{name}"
RS = "https://www.regionstockholm.se/{path}"
# year -> (download URL, original publisher URL)
EDITIONS = {
    2013: ("20210830224013", "slpr191_sl_och_lanet_2013_webb.pdf"),
    2014: ("20210830223847", "fakta-om-sl-och-lanet-2014.pdf"),
    2015: ("20210830223849", "fakta-sl-waxholmsbolaget-fardtjanstent-2015-webb.pdf"),
    2016: ("20190531191308", "sl_och_lanet_2016.pdf"),
    2017: ("20190516121842", "sl_och_lanet_2017.pdf"),
    2018: ("20191107154727", "sl_och_lanet_2018.pdf"),
    2019: (None, "495c57/contentassets/5a0a0613b760462eb20796fe1059604f/fakta-om-sl-och-lanet-2019.pdf"),
    2020: (None, "495bbb/contentassets/d1d97951af2947f196e7ae18e81aec83/fakta-om-sl-och-lanet-2020.pdf"),
    2021: (None, "495b8b/contentassets/654bc6f30ecd466a9bdd145297d82e6e/fakta-om-sl-och-lanet-2021.pdf"),
    2022: (None, "495b8a/contentassets/d393cbd34cdc4b3485b7ae0538f48f42/fakta-om-sl-och-lanet-2022.pdf"),
}
BANDS = ("day", "h06_09", "h0730_0830", "h15_18", "h1630_1730")
LINES = {"röda linjen": "red", "röd linje": "red", "gröna linjen": "green", "grön linje": "green",
         "blå linjen": "blue", "blå linje": "blue"}
NUMBER = r"\d{1,3}(?: \d{3})*"
PAIR = re.compile(rf"([A-Za-zÅÄÖåäöÉé][A-Za-zÅÄÖåäöÉé:.\- ]*?)\s+({NUMBER})\s*\**(?=\s|$)")
HEADER = {"hållplats", "bana", "dygn", "klockan", "tabellbilaga", "forts.", "forts:"}


def urls(year: int) -> tuple[str, str]:
    stamp, name = EDITIONS[year]
    if stamp:
        return ARCHIVE.format(stamp=stamp, name=name), ARCHIVE.split("id_/")[1].format(name=name)
    url = RS.format(path=name)
    return url, url


def is_pdf(payload: bytes) -> None:
    if not payload.startswith(b"%PDF"):
        raise ValueError("not a PDF")


def number(text: str) -> int:
    return int(text.replace(" ", "").rstrip("*"))


def skipped(name: str) -> bool:
    """Line totals and sub-rows: "Blå linjen", "Totalt röda linjen", "Tunnelbana totalt", and the
    2017 rows "Varav pendel" (the part of a station's boardings that came from commuter rail)."""
    low = name.lower()
    return low.endswith(("linje", "linjen")) or low.startswith(("totalt", "tunnelbana", "varav"))


def map_page(doc) -> int | None:
    """The first page (0-based) with the metro map."""
    return next((i for i, page in enumerate(doc)
                 if re.search(r"tunnelbana", t := page.get_text(), re.I) and re.search(r"p.stigande", t, re.I)
                 and "Mariatorget" in t and re.search(r"Akalla|AKALLA", t)), None)


def appendix_pages(doc) -> list[int]:
    """Pages (0-based) of the appendix table of metro boardings; 2013–2020 only."""
    return [i for i, page in enumerate(doc)
            if re.search(r"Påstigande vintervardag \d{4} – tunnelbana", page.get_text())]


def map_values(page) -> dict[str, int]:
    """Station -> day value from the map page. Labels are split over lines and set at 45°; a text
    block holds one label, or its name while the next block holds its number, so the lines of a
    block are joined and a name-only block is joined to a number-only block after it."""
    texts = []
    for block in page.get_text("dict")["blocks"]:
        text = ""
        for line in block.get("lines", []):
            part = "".join(s["text"] for s in line["spans"]).replace("", " ").replace("	", " ").strip()
            text = text[:-1] + part if text.endswith("-") else f"{text} {part}".strip()
        if texts and re.fullmatch(NUMBER, text) and not re.search(r"\d", texts[-1]):
            texts[-1] = f"{texts[-1]} {text}"
        else:
            texts.append(text)
    values: dict[str, int] = {}
    for text in texts:
        for name, value in PAIR.findall(text):
            # A label in the "most and fewest boardings" box carries the box's heading.
            name = re.sub(r"^.*(?:påstigande|resenärer)\s+", "", " ".join(name.split()), flags=re.I).strip(" -")
            if skipped(name):
                continue
            if name in values and values[name] != number(value):
                raise ValueError(f"{name}: {values[name]} and {value} on one map")
            values[name] = number(value)
    return values


def appendix_rows(doc, pages: list[int]) -> list[dict]:
    """Rows of the boardings table on `pages`: station, line (when the edition gives one per row)
    and the five bands. A 2013–2017 sub-row that repeats a station per line is skipped, since the
    station's own row holds the total, and so is the metro total. Header and footer blocks (page
    numbers, headings) are left out by position."""
    rows, name, line, values = [], None, None, []
    for index in pages:
        page = doc[index]
        height = page.rect.height
        for block in page.get_text("blocks"):
            if block[1] < 0.06 * height or block[3] > 0.95 * height:
                continue
            for raw in block[4].splitlines():
                item = " ".join(raw.split())
                if (not item or item.lower() in HEADER or re.fullmatch(r"[\d.]+–[\d.]+", item)
                        or re.search(r"stigande vintervardag", item)):
                    continue
                if re.fullmatch(NUMBER, item):
                    if name is None:
                        continue
                    values.append(number(item))
                    if len(values) == len(BANDS):
                        if not skipped(name):
                            rows.append({"station": name, "line": line, **dict(zip(BANDS, values))})
                        name, line, values = None, None, []
                elif values:
                    raise ValueError(f"page {index + 1}: '{item}' inside the row of {name}")
                elif item.lower() in LINES and name and name.lower() not in LINES:
                    line = LINES[item.lower()]
                elif name and name.endswith("-"):
                    name = name[:-1] + item
                else:
                    name, line = item, None
    return rows


def parse(path: Path, year: int) -> dict:
    doc = pymupdf.open(path)
    pages, first = appendix_pages(doc), map_page(doc)
    if first is None:
        raise ValueError(f"{year}: no metro map found")
    # The appendix is the complete table where an edition has one. The map is read too: it is the
    # only source in 2021 and 2022, and in 2017 it holds the two stations whose appendix rows are
    # split per line and per transfer in a layout this reader does not take apart (T-Centralen,
    # Odenplan). Some maps' labels overlap (2015, 2016), so a map name is used only when it
    # matches a GTFS station (bronze) and the appendix lacks it (gold).
    try:
        stations = map_values(doc[first])
    except ValueError:
        if not pages:
            raise
        stations = {}
    return {"year": year, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "map_page": first + 1, "appendix_pages": [p + 1 for p in pages],
            "stations": [{"station": s, "day": v} for s, v in sorted(stations.items())],
            "appendix": appendix_rows(doc, pages)}


def main() -> None:
    http = session()
    for year in EDITIONS:
        url, original = urls(year)
        path = fetch(http, SOURCE, f"pdf/{year}.pdf", url, pause=1.0, max_age_days=365, validate=is_pdf)
        parsed = parse(path, year) | {"url": url, "original_url": original}
        write_json(rawstore.RAW / SOURCE / "parsed" / f"{year}.json", parsed, indent=1)
        print(f"sl_facts {year}: {len(parsed['stations'])} stations on the map, "
              f"{len(parsed['appendix'])} appendix rows")


if __name__ == "__main__":
    main()
