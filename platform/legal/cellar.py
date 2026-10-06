"""The Publications Office's Cellar: the official repository behind EUR-Lex.

Two things are used, both without a key:

* the SPARQL endpoint, for the documents related to an act: the acts that amend or correct it,
  its consolidated versions, the proposals to amend it, and the acts based on it, each with
  its CELEX number, date and English title;
* content negotiation on `https://publications.europa.eu/resource/celex/<CELEX>`, which serves
  an act's text as XHTML in a chosen language.

EUR-Lex's own pages (`eur-lex.europa.eu`) are the links a reader follows; they are not fetched,
since EUR-Lex answers automated requests with a browser challenge.
"""
from __future__ import annotations

SPARQL = "https://publications.europa.eu/webapi/rdf/sparql"
RESOURCE = "https://publications.europa.eu/resource/celex/{celex}"
LANGUAGES = {"en": "eng", "sv": "swe"}

# The relations of interest, Cellar's property name -> a plain name. Citations
# (`work_cites_work`) are left out: everything that mentions an act is not about it.
RELATIONS = {
    "resource_legal_amends_resource_legal": "amends",
    "resource_legal_corrects_resource_legal": "corrects",
    "resource_legal_proposes_to_amend_resource_legal": "proposes_to_amend",
    "act_consolidated_consolidates_resource_legal": "consolidates",
    "resource_legal_based_on_resource_legal": "based_on",
    "resource_legal_adopts_resource_legal": "adopts",
}

RELATED_QUERY = """
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?relation ?date ?title WHERE {{
  ?act cdm:resource_legal_id_celex "{celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  ?other ?relation ?act .
  ?other cdm:resource_legal_id_celex ?celex .
  VALUES ?relation {{ {relations} }}
  OPTIONAL {{ ?other cdm:work_date_document ?date }}
  OPTIONAL {{
    ?expression cdm:expression_belongs_to_work ?other ;
                cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
                cdm:expression_title ?title
  }}
}}
ORDER BY ?date ?celex
"""


# Documents the act itself points to: the proposal it adopts (its legislative origin).
ORIGIN_QUERY = """
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?relation ?date ?title WHERE {{
  ?act cdm:resource_legal_id_celex "{celex}"^^<http://www.w3.org/2001/XMLSchema#string> .
  ?act ?relation ?other .
  ?other cdm:resource_legal_id_celex ?celex .
  VALUES ?relation {{ cdm:resource_legal_adopts_resource_legal }}
  OPTIONAL {{ ?other cdm:work_date_document ?date }}
  OPTIONAL {{
    ?expression cdm:expression_belongs_to_work ?other ;
                cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> ;
                cdm:expression_title ?title
  }}
}}
"""


def origin_query(celex: str) -> str:
    return ORIGIN_QUERY.format(celex=celex)


def related_query(celex: str) -> str:
    relations = " ".join(f"cdm:{name}" for name in RELATIONS)
    return RELATED_QUERY.format(celex=celex, relations=relations)


def text_url(celex: str) -> str:
    return RESOURCE.format(celex=celex)


def text_headers(language: str) -> dict:
    """Headers asking Cellar for an act's XHTML in `language` ('en' or 'sv')."""
    return {"Accept": "application/xhtml+xml", "Accept-Language": LANGUAGES[language]}


def eurlex_url(celex: str, language: str = "en") -> str:
    """The EUR-Lex page a reader opens for a CELEX number."""
    return f"https://eur-lex.europa.eu/legal-content/{language.upper()}/TXT/?uri=CELEX:{celex}"


def parse_related(answer: dict) -> list[dict]:
    """SPARQL JSON results -> [{celex, relation, date, title}] with plain relation names."""
    rows = []
    for binding in answer.get("results", {}).get("bindings", []):
        relation = binding["relation"]["value"].rsplit("#", 1)[-1]
        rows.append({
            "celex": binding["celex"]["value"],
            "relation": RELATIONS.get(relation, relation),
            "date": binding.get("date", {}).get("value"),
            "title": binding.get("title", {}).get("value"),
        })
    return rows
