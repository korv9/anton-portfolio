# Old Bailey Online XML data

| Field | Value |
| --- | --- |
| Name | Old Bailey Online XML Data, version 7.2 (March 2015) |
| Publisher | Old Bailey Online project: University of Sheffield, University of Hertfordshire, The Open University |
| Deposit | University of Sheffield ORDA, doi:[10.15131/shef.data.4775434.v2](https://doi.org/10.15131/shef.data.4775434.v2) |
| File | `OBO_XML_7-2.zip`, 315,221,598 bytes, from `https://ndownloader.figshare.com/files/7979134` |
| Contents | 2,163 Proceedings session files (1674-1913) and 475 Ordinary's Accounts, TEI-style XML |
| Licence | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |
| Checked | 2026-10-22: the ORDA record's licence field, and `licence.txt` and `OB_xml_notes.docx` in the deposit |

## Licence and use

The deposit is CC BY-NC 4.0, not CC BY-NC-SA. The CC BY-NC-SA 4.0 licence often quoted for "Old
Bailey" applies to the separate Old Bailey Corpus (Saarland/CLARIN-D), which this project does not
use. The portfolio is non-commercial. Attribution goes with every copy and every export:

> This work builds on Old Bailey Online, licensed under a Creative Commons
> Attribution-NonCommercial 4.0 International License (www.oldbaileyonline.org).

## Where it is stored

- Fetch: `python platform/ingest/oldbailey/fetch.py` writes `warehouse/raw/oldbailey/` with the
  zip, its URL, time and SHA-256 in `_manifest.jsonl`, and `ATTRIBUTION.txt`.
- R2: `warehouse/raw/oldbailey/` in the public bucket, pushed with
  `platform/publish/warehouse_store.py push --only raw --path oldbailey`. The zip is unchanged and
  sits next to its attribution file.
- Trial text extracted from the zip stays local in `warehouse/ml/oldbailey/`, which is never
  pushed. Model answers (labels only) are in `warehouse/features/oldbailey/`.
- Site: only counts and scores, in `humanities/oldbailey/extraction.json` (delivery group
  baseline, schema `configs/delivery/schemas/humanities/oldbailey-extraction.json`).

## Used by

The extraction test in `docs/oldbailey-extraction-preregistration.md` (`ml/oldbailey/`).

## Data notes

- Defendants, victims and witnesses are named in the text. They are historical people, but no
  names or trial text are published here.
- Part 1 (1674-1834) and part 2 (1834-1913) were digitised in separate phases. For part of the
  18th century, many sentences were printed only in a summary after the trials.
