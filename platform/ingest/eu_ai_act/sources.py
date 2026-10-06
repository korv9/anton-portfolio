"""The official sources of the EU AI Act Observatory, in one place.

Only official EU sources: the regulation and every act related to it come from the
Publications Office's Cellar (the repository behind EUR-Lex); guidance and codes of practice
from the European Commission's pages, linked from its AI Act policy page. No secondary source
is used for legal data.

`GUIDANCE` is a hand-kept list of Commission pages. Titles and publication dates are read from
the pages themselves (silver), not typed here; `kind` is our classification.
"""
from __future__ import annotations

# Regulation (EU) 2024/1689, the Artificial Intelligence Act.
CELEX = "32024R1689"
DOCUMENT_ID = "eu-ai-act"
LANGUAGES = ("en", "sv")
# Consolidated versions are CELEX `0` + the act + `-<date>`; this is their common prefix.
CONSOLIDATED_PREFIX = "02024R1689-"

POLICY_PAGE = "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai"
SERVICE_DESK = "https://ai-act-service-desk.ec.europa.eu/en"

DS = "https://digital-strategy.ec.europa.eu/en"
GUIDANCE = [
    {"id": "policy-page", "kind": "policy_page", "url": POLICY_PAGE},
    {"id": "service-desk", "kind": "service_desk", "url": SERVICE_DESK},
    {"id": "guidelines-prohibited-practices", "kind": "guidelines", "articles": ["5"],
     "url": f"{DS}/library/commission-publishes-guidelines-prohibited-artificial-intelligence-ai-practices-defined-ai-act"},
    {"id": "guidelines-ai-system-definition", "kind": "guidelines", "articles": ["3"],
     "url": f"{DS}/library/commission-publishes-guidelines-ai-system-definition-facilitate-first-ai-acts-rules-application"},
    {"id": "guidelines-gpai-obligations", "kind": "guidelines", "articles": ["53", "55"],
     "url": f"{DS}/library/guidelines-scope-obligations-providers-general-purpose-ai-models-under-ai-act"},
    {"id": "code-of-practice-gpai", "kind": "code_of_practice", "articles": ["53", "55", "56"],
     "url": f"{DS}/policies/contents-code-gpai"},
    {"id": "template-training-content-summary", "kind": "template", "articles": ["53"],
     "url": f"{DS}/library/explanatory-notice-and-template-public-summary-training-content-general-purpose-ai-models"},
    {"id": "code-of-practice-ai-generated-content", "kind": "code_of_practice", "articles": ["50"],
     "url": f"{DS}/policies/code-practice-ai-generated-content"},
    {"id": "guidelines-transparency", "kind": "guidelines", "articles": ["50"],
     "url": f"{DS}/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems"},
    {"id": "digital-omnibus-ai-proposal", "kind": "proposal_page", "articles": [],
     "url": f"{DS}/library/digital-omnibus-ai-regulation-proposal"},
]
