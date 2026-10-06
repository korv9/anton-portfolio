"""The vocabulary of the quality layer: data-quality dimensions, statuses, severities, methods,
and the separate vocabulary of analytical validity.

Data quality asks whether the data correctly represents what it claims to represent. The
dimensions are a selection of the data-quality characteristics of ISO/IEC 25012 (Software
engineering — SQuaRE — Data quality model). This is an internal engineering model mapped to the
standard's characteristics; it is not a certification and not a complete implementation.

Analytical validity asks whether an analysis or model measures the construct it is meant to.
It is not an ISO/IEC 25012 characteristic and is never recorded as one: a correct dataset can
still support an invalid conclusion.
"""
from __future__ import annotations

# The ISO/IEC 25012 characteristics this platform evaluates. `point_of_view` is the standard's
# grouping: inherent (the data itself) or inherent and system-dependent.
DIMENSIONS = {
    "accuracy": {
        "label_en": "Accuracy", "label_sv": "Riktighet",
        "question_en": "Does the data match the source?",
        "question_sv": "Stämmer datan med källan?",
        "iso_25012": "Accuracy (inherent): the degree to which data has attributes that correctly "
                     "represent the true value of the intended attribute of a concept or event.",
        "point_of_view": "inherent",
        "note": "A stored or derived value against its source. Never used for whether a model "
                "measures the intended concept; that is construct validity.",
    },
    "completeness": {
        "label_en": "Completeness", "label_sv": "Fullständighet",
        "question_en": "Is expected data missing?",
        "question_sv": "Saknas data som borde finnas?",
        "iso_25012": "Completeness (inherent): the degree to which subject data associated with an "
                     "entity has values for all expected attributes and related entity instances.",
        "point_of_view": "inherent",
    },
    "consistency": {
        "label_en": "Consistency", "label_sv": "Konsistens",
        "question_en": "Do related records agree?",
        "question_sv": "Stämmer relaterade poster överens?",
        "iso_25012": "Consistency (inherent): the degree to which data is free from contradiction "
                     "and is coherent with other data in a specific context of use.",
        "point_of_view": "inherent",
    },
    "credibility": {
        "label_en": "Credibility", "label_sv": "Trovärdighet",
        "question_en": "Where does the data come from?",
        "question_sv": "Var kommer datan ifrån?",
        "iso_25012": "Credibility (inherent): the degree to which data has attributes that are "
                     "regarded as true and believable by users, including source authenticity.",
        "point_of_view": "inherent",
    },
    "currentness": {
        "label_en": "Currentness", "label_sv": "Aktualitet",
        "question_en": "How fresh is the data?",
        "question_sv": "Hur färsk är datan?",
        "iso_25012": "Currentness (inherent): the degree to which data has attributes that are of "
                     "the right age in a specific context of use.",
        "point_of_view": "inherent",
    },
    "traceability": {
        "label_en": "Traceability", "label_sv": "Spårbarhet",
        "question_en": "Can every value be traced to the file it came from?",
        "question_sv": "Kan varje värde spåras till filen det kom från?",
        "iso_25012": "Traceability (inherent and system-dependent): the degree to which data has "
                     "attributes that provide an audit trail of access and changes.",
        "point_of_view": "inherent and system-dependent",
    },
}

# The order dimensions are shown in.
DIMENSION_ORDER = list(DIMENSIONS)

STATUSES = ("pass", "warning", "fail", "not_measured", "not_applicable")
SEVERITIES = ("info", "warning", "error")
# How a check is evaluated.
METHODS = ("dbt_test", "python", "manual_review", "not_applicable", "not_measured")
COMPARATORS = (">=", "<=", "==")

# Analytical validity: a separate vocabulary. Never "true", "proven" or "verified meaning".
VALIDITY_STATUSES = ("supported", "warning", "insufficient_evidence", "invalidated", "not_evaluated")
VALIDITY_KINDS = {
    "construct_validity": {
        "label_en": "Construct validity", "label_sv": "Begreppsvaliditet",
        "question_en": "Are we measuring the thing we think we're measuring?",
        "question_sv": "Mäter vi det vi tror att vi mäter?",
    },
    "confounding": {
        "label_en": "Confounding", "label_sv": "Störfaktorer",
        "question_en": "Could something else explain the result?",
        "question_sv": "Kan något annat förklara resultatet?",
    },
    "representativeness": {
        "label_en": "Representativeness", "label_sv": "Representativitet",
        "question_en": "Does the data represent the domain the question is about?",
        "question_sv": "Representerar datan det område frågan gäller?",
    },
    "ml_data_quality": {
        "label_en": "ML data quality", "label_sv": "Datakvalitet för ML",
        "question_en": "Are training and evaluation data sound (splits, leakage, balance)?",
        "question_sv": "Är tränings- och utvärderingsdatan sunda (uppdelning, läckage, balans)?",
    },
}

# Source / derived / interpretation, the platform-wide content types.
CONTENT_TYPES = ("source", "derived", "interpretation")
