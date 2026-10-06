"""The small, hand-maintained part of the Data Constellation (build_graph.py).

dbt knows its own models, seeds and sources; everything here is what dbt cannot see:

- DOMAINS: the products the platform serves, in lane order (shared infrastructure in the middle).
- DBT_FOLDER_DOMAIN: which domain a dbt folder (models/<layer>/<folder>, seeds/<folder>) belongs to.
- ORIGINS: the external systems data is fetched from, with the host each ingester calls.
- INGESTION: each platform/ingest/<dir> (or other loader): the origins it reads and the dbt
  sources (raw landing tables) it fills.
- ML: analytical stages outside dbt: their dbt inputs and what they write (a dbt source the
  warehouse reads back, or delivery files). They are drawn in the ML column between silver and
  gold unless `layer` says otherwise (a stage that reads gold sits beside it).
- PUBLISHERS: scripts that write the site's data files. `outputs` are path patterns under
  frontend/public/data ('*' within a segment, '**' across segments); the dbt tables a script
  reads are found in its source automatically, unless `inputs` lists them; an output may name
  its own `domain`.
- PRODUCTS: the frontend experiences, with the frontend folders/files whose data paths decide
  which delivery files each consumes.
- SHARED: infrastructure several domains use.

Every entry names a real file; build_graph.py fails if one does not exist.
"""

DOMAINS = [
    {"id": "politics", "label": "Politics", "lane": 0},
    {"id": "jobs", "label": "Job market", "lane": 1},
    {"id": "shared", "label": "Shared platform", "lane": 2},
    {"id": "welfare", "label": "Sweden", "lane": 3},
    {"id": "symbolic", "label": "Symbolic Atlas", "lane": 4},
    {"id": "ai_act", "label": "EU AI Act", "lane": 5},
    {"id": "philosophy", "label": "Philosophy Atlas", "lane": 6},
    {"id": "concepts", "label": "Concept layer", "lane": 7},
]

DBT_FOLDER_DOMAIN = {
    "parliament": "politics", "politics": "politics", "news": "politics", "taxes": "politics",
    "jobs": "jobs", "market": "jobs",
    "welfare": "welfare",
    "symbolic": "symbolic",
    "eu_ai_act": "ai_act",
    "ai_politics": "ai_act",
    "job_ai_governance": "ai_act",  # AI governance words in job ads, read against the Act
    "philosophy": "philosophy",
    "concepts": "concepts",  # four corpora read against one set of curated concepts
    "quality": "shared",  # quality checks and validity diagnostics across every product
    "cross_domain": "ai_act",  # the AI governance timeline: Riksdag and job ads by month
    "shared": "shared",
    "": "jobs",  # seeds at the root of seeds/: the job-ad role and technology patterns
}

ORIGINS = [
    {"id": "riksdagen", "label": "Riksdagen", "domain": "politics", "url": "https://data.riksdagen.se",
     "description": "Riksdagen's open data: votes, decisions, documents, speeches, members, studies."},
    {"id": "valmyndigheten", "label": "Valmyndigheten", "domain": "politics", "url": "https://resultat.val.se",
     "description": "Official Riksdag election results."},
    {"id": "scb", "label": "SCB", "domain": "shared", "url": "https://api.scb.se",
     "description": "Statistics Sweden's PxWeb API: labour force, population, elections, party preferences, household spending."},
    {"id": "news-feeds", "label": "Regeringen & Sveriges Radio", "domain": "politics",
     "url": "https://www.regeringen.se",
     "description": "News feeds from the Government Offices and Sveriges Radio (api.sr.se)."},
    {"id": "skatteverket", "label": "Skatteverket", "domain": "politics", "url": "https://skatteverket.entryscape.net",
     "description": "Municipal tax rates and tax rules (open data)."},
    {"id": "oecd", "label": "OECD", "domain": "politics", "url": "https://sdmx.oecd.org",
     "description": "Tax revenue and tax wedges for the international comparison (SDMX)."},
    {"id": "arbetsformedlingen", "label": "Arbetsförmedlingen / JobTech", "domain": "jobs",
     "url": "https://data.arbetsformedlingen.se",
     "description": "Job ads: the JobSearch API and the historical ad archives since 2020."},
    {"id": "forsakringskassan", "label": "Försäkringskassan", "domain": "welfare", "url": "https://www.forsakringskassan.se",
     "description": "Sick-leave and sick-pay statistics."},
    {"id": "folkhalsomyndigheten", "label": "Folkhälsomyndigheten", "domain": "welfare",
     "url": "https://fohm-app.folkhalsomyndigheten.se",
     "description": "The national public health survey (Folkhälsodata PxWeb)."},
    {"id": "kolada", "label": "Kolada", "domain": "welfare", "url": "https://api.kolada.se",
     "description": "Key figures per municipality and county (RKA)."},
    {"id": "ess", "label": "European Social Survey", "domain": "welfare", "url": "https://ess.sikt.no",
     "description": "ESS rounds 1–11, integrated files."},
    {"id": "gutenberg", "label": "Project Gutenberg", "domain": "symbolic", "url": "https://www.gutenberg.org",
     "description": "Ten public-domain books of myth, folklore and literature, and thirteen works of philosophy."},
    {"id": "publications-office", "label": "EU Publications Office (EUR-Lex)", "domain": "ai_act",
     "url": "https://publications.europa.eu/webapi/rdf/sparql",
     "description": "Cellar, the repository behind EUR-Lex: the AI Act's text in English and Swedish, its consolidated versions, amending acts, corrigenda and related documents."},
    {"id": "european-commission", "label": "European Commission", "domain": "ai_act",
     "url": "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
     "description": "The Commission's AI Act pages: guidelines, codes of practice, templates and the AI Act Service Desk."},
]

INGESTION = [
    {"id": "riksdagen", "path": "platform/ingest/riksdagen", "domain": "politics",
     "origins": ["riksdagen"], "raw": ["riksdagen", "politics_delivery", "riksdagen_speeches"],
     "description": "Votes, decision points, documents, studies and budgets from Riksdagen."},
    {"id": "elections", "path": "platform/ingest/elections", "domain": "politics",
     "origins": ["scb", "valmyndigheten", "riksdagen"], "raw": ["scb_elections", "val"],
     "description": "Election results, seats and the party preference survey."},
    {"id": "news", "path": "platform/ingest/news", "domain": "politics",
     "origins": ["news-feeds", "riksdagen"], "raw": ["news"],
     "description": "News items and the people they mention; the archive is kept on R2 between runs."},
    {"id": "taxes", "path": "platform/ingest/taxes", "domain": "politics",
     "origins": ["skatteverket", "scb", "oecd"], "raw": ["skatteverket", "scb_household_spending"],
     "description": "Tax rates, household spending and international tax comparisons."},
    {"id": "jobtech", "path": "platform/ingest/jobtech", "domain": "jobs",
     "origins": ["arbetsformedlingen"], "raw": ["jobtech", "jobtech_market", "jobtech_governance"],
     "description": "Job ads from the JobSearch API and ad counts from every historical archive."},
    {"id": "scb", "path": "platform/ingest/scb", "domain": "welfare",
     "origins": ["scb"], "raw": ["scb"], "description": "Labour force survey and population."},
    {"id": "fk", "path": "platform/ingest/fk", "domain": "welfare",
     "origins": ["forsakringskassan"], "raw": ["fk"], "description": "Sick-leave statistics."},
    {"id": "fohm", "path": "platform/ingest/fohm", "domain": "welfare",
     "origins": ["folkhalsomyndigheten"], "raw": ["fohm"], "description": "Public health survey."},
    {"id": "kolada", "path": "platform/ingest/kolada", "domain": "welfare",
     "origins": ["kolada"], "raw": ["kolada"], "description": "Municipal key figures."},
    {"id": "ess", "path": "platform/ingest/ess", "domain": "welfare",
     "origins": ["ess"], "raw": ["ess"], "description": "European Social Survey microdata."},
    {"id": "symbolic", "path": "platform/ingest/symbolic", "domain": "symbolic",
     "origins": ["gutenberg"], "raw": ["symbolic"],
     "description": "The Gutenberg corpus, every fetch logged with URL, time and SHA-256."},
    {"id": "philosophy", "path": "platform/ingest/philosophy", "domain": "philosophy",
     "origins": ["gutenberg"], "raw": ["philosophy"],
     "description": "Thirteen public-domain works of philosophy, with translators, every fetch logged."},
    {"id": "eu_ai_act", "path": "platform/ingest/eu_ai_act", "domain": "ai_act",
     "origins": ["publications-office", "european-commission"], "raw": ["eu_ai_act"],
     "description": "The AI Act and every related act from Cellar, and the Commission's guidance pages; texts kept per CELEX number and language, changing pages kept per version."},
]

ML = [
    {"id": "symbolic-pipeline", "label": "Embeddings, UMAP, HDBSCAN", "path": "platform/nlp/symbolic/pipeline.py",
     "domain": "symbolic", "inputs": ["int_symbol_occurrences"], "raw": ["symbolic_features"],
     "description": "Sentence embeddings of each occurrence's context, a 2-D map and clusters; read back by gold as a source."},
    {"id": "symbolic-review", "label": "Deconfounding experiments & review",
     "path": "platform/nlp/symbolic/rank_clusters.py", "domain": "symbolic",
     "inputs": ["int_symbol_occurrences", "int_symbolic_documents"],
     "description": "Baseline, masked and book-centred runs (experiments.py) and the ranking of clusters for human review."},
    {"id": "philosophy-pipeline", "label": "Philosophy embeddings, maps, tensions",
     "path": "platform/nlp/philosophy/pipeline.py", "domain": "philosophy",
     "inputs": ["int_philosophy_passages"], "raw": ["philosophy_features"],
     "description": "Balanced sample, multilingual embeddings, raw and work-centred UMAP + HDBSCAN, dominance metrics and tension scores."},
    {"id": "concept-layer", "label": "Concept layer across four corpora",
     "path": "platform/nlp/concepts/build.py", "domain": "concepts",
     "inputs": ["int_symbol_occurrences", "int_philosophy_passages", "int_riksdag_speeches", "int_ai_act_provisions"],
     "raw": ["concept_features"],
     "description": "Balanced chunks from myth, philosophy, Riksdag speeches and the AI Act, one multilingual model, alignment to curated concepts, cross-corpus pairs and dominance metrics."},
    {"id": "ai-politics-similarity", "label": "AI Act ↔ Riksdag similarity",
     "path": "platform/nlp/ai_politics/similarity.py", "domain": "ai_act",
     "inputs": ["int_ai_act_provisions", "int_ai_speech_paragraphs"], "raw": ["ai_politics_features"],
     "description": "Multilingual sentence embeddings of the Act's Swedish passages and the Riksdag's AI paragraphs; nearest pairs and a chance baseline, read back by gold."},
    # It reads a gold table (the skills bridge), so it sits beside gold, and its results
    # re-enter the warehouse as raw tables that gold marts read.
    {"id": "job-clusters", "label": "Job-ad clustering", "path": "ml/jobs/pipeline.py", "domain": "jobs",
     "layer": "gold",
     "inputs": ["int_job_ads_enriched", "bridge_job_skills"], "raw": ["jobs_ml"],
     "description": "Embeddings, UMAP and HDBSCAN on IT job ads; results enter the warehouse as raw tables."},
]

# Patterns are relative to frontend/public/data.
PUBLISHERS = [
    {"path": "platform/publish/symbolic/export_symbolic.py", "domain": "symbolic", "outputs": [
        {"pattern": "symbolic/atlas.parquet", "inputs": ["mart_symbol_atlas"]},
        {"pattern": "symbolic/symbol-profiles.parquet", "inputs": ["mart_symbol_profiles"]},
        {"pattern": "symbolic/summary.json", "inputs": ["mart_symbol_atlas", "int_symbolic_documents"]},
        {"pattern": "symbolic/preview.json", "inputs": ["mart_symbol_atlas"]},
        {"pattern": "symbolic/book-centered-*", "inputs": ["ml:symbolic-review"]},
        {"pattern": "symbolic/cross-book-clusters.json", "inputs": ["ml:symbolic-review"]},
        {"pattern": "symbolic/reviewed-clusters.json", "inputs": ["ml:symbolic-review"]},
        {"pattern": "symbolic/research-history.json", "inputs": ["ml:symbolic-review"]},
        {"pattern": "symbolic/experiment-comparison.json", "inputs": ["ml:symbolic-review"]},
    ]},
    {"path": "platform/publish/eu_ai_act/export_ai_act.py", "domain": "ai_act", "outputs": [
        {"pattern": "ai-act/article-text-*.json", "inputs": ["dim_ai_act_article", "dim_ai_act_annex"]},
        {"pattern": "ai-act/obligations.json", "inputs": ["mart_ai_act_obligations"]},
        {"pattern": "ai-act/timeline.json", "inputs": ["mart_ai_act_timeline"]},
        {"pattern": "ai-act/changes.json", "inputs": ["mart_ai_act_changes"]},
        {"pattern": "ai-act/navigator.json", "inputs": ["mart_ai_act_obligations", "dim_ai_act_actor", "dim_ai_act_risk_class"]},
        {"pattern": "ai-act/*.json"},
    ]},
    {"path": "platform/publish/ai_politics/export_ai_politics.py", "domain": "ai_act", "outputs": [
        {"pattern": "ai-act/politics/similarity.json", "inputs": ["mart_ai_act_speech_similarity"]},
        {"pattern": "ai-act/politics/*.json"},
    ]},
    {"path": "platform/publish/philosophy/export_philosophy.py", "domain": "philosophy",
     "outputs": [{"pattern": "philosophy/*.json"}]},
    {"path": "platform/publish/cross_domain/export_ai_governance_timeline.py", "domain": "ai_act",
     "outputs": [{"pattern": "ai-act/signals.json", "inputs": ["mart_ai_governance_timeline"]}]},
    {"path": "platform/publish/quality/export_quality.py", "domain": "shared",
     "outputs": [{"pattern": "quality/*.json", "inputs": ["mart_quality_checks", "mart_analysis_validity"]}]},
    {"path": "platform/publish/concepts/export_concepts.py", "domain": "concepts",
     "outputs": [{"pattern": "concepts/*.json"}]},
    {"path": "platform/publish/job_ai_governance/export_job_ai_governance.py", "domain": "ai_act",
     "outputs": [{"pattern": "ai-act/jobs/*.json"}]},
    {"path": "platform/publish/export_market.py", "domain": "jobs", "outputs": [{"pattern": "jobs/market.json"}]},
    {"path": "platform/ingest/jobtech/export_presentation.py", "domain": "jobs",
     "outputs": [{"pattern": "jobs/*.csv"}]},
    {"path": "platform/publish/export_job_clusters.py", "domain": "jobs", "outputs": [
        {"pattern": "jobs/cluster-*.json", "inputs": ["mart_job_clusters", "dim_job_clusters"]},
        {"pattern": "jobs/clusters/**", "inputs": ["mart_job_clusters", "dim_job_clusters"]},
    ]},
    {"path": "platform/publish/export_welfare.py", "domain": "welfare", "outputs": [
        {"pattern": "welfare/*.json"}, {"pattern": "parquet/welfare/**"},
        {"pattern": "parquet/welfare_indicator/**"},
    ]},
    {"path": "platform/publish/export_taxes.py", "domain": "politics", "outputs": [{"pattern": "taxes/*.json"}]},
    {"path": "platform/publish/export_parliament.py", "domain": "politics", "outputs": [
        {"pattern": "parliament/*.json"}, {"pattern": "parquet/parliament_roll_calls/**"},
    ]},
    {"path": "platform/publish/export_news.py", "domain": "politics", "outputs": [{"pattern": "parliament/*.json"}]},
    {"path": "platform/publish/export_politics.py", "domain": "politics", "outputs": [
        {"pattern": "gold/marts/votes/**"}, {"pattern": "gold/marts/budget-context.json"},
    ]},
    {"path": "platform/publish/export_debates.py", "domain": "politics", "outputs": [
        {"pattern": "politics/parliament/**"}, {"pattern": "parquet/speech_cards/**"},
        {"pattern": "gold/marts/budget-report.json"},
    ]},
    {"path": "platform/publish/export_party_profiles.py", "domain": "politics",
     "outputs": [{"pattern": "politics/parties/**"}]},
    {"path": "platform/publish/build_parquet.py", "domain": "politics",
     "outputs": [{"pattern": "parquet/fact_member_vote/**", "inputs": ["ingest:riksdagen"]}]},
    # The politics deliveries that predate the warehouse are still built from raw Riksdagen data.
    {"path": "platform/legacy/build_gold.py", "domain": "politics", "legacy": True, "outputs": [
        {"pattern": "gold/tables/**", "inputs": ["ingest:riksdagen"]},
        {"pattern": "gold/marts/debate/**", "inputs": ["ingest:riksdagen"]},
        {"pattern": "gold/marts/jobs.json", "inputs": ["out:jobs/*.csv"], "domain": "jobs"},
        {"pattern": "politics/decisions/**", "inputs": ["ingest:riksdagen"]},
        {"pattern": "politics/laws/**", "inputs": ["ingest:riksdagen"]},
        {"pattern": "debates/**", "inputs": ["ingest:riksdagen"]},
    ]},
]

PRODUCTS = [
    {"id": "politics", "label": "Swedish politics in numbers", "href": "#politik", "domain": "politics",
     "frontend": ["frontend/src/politik", "frontend/src/politics", "frontend/src/parliament",
                  "frontend/src/parties", "frontend/src/taxes", "frontend/src/BudgetLab.tsx",
                  "frontend/src/BudgetLedger.tsx", "frontend/src/BudgetOutturn.tsx",
                  "frontend/src/BudgetOverview.tsx", "frontend/src/BudgetLanguage.tsx"],
     "description": "Votes, budgets, debates, elections, taxes and news, as one product with seven themes."},
    {"id": "jobs", "label": "Job market in numbers", "href": "#jobb", "domain": "jobs",
     "frontend": ["frontend/src/jobb", "frontend/src/jobs"],
     "description": "Every ad in Arbetsförmedlingen's archives since 2020, and semantic clusters of IT ads."},
    {"id": "welfare", "label": "How is Sweden doing?", "href": "#sweden", "domain": "welfare",
     "frontend": ["frontend/src/welfare", "frontend/src/analysis"],
     "description": "Jobs, health, trust and welfare from five public sources."},
    {"id": "symbolic", "label": "Symbolic Atlas", "href": "#symbolic-atlas", "domain": "symbolic",
     "frontend": ["frontend/src/symbolic"],
     "description": "Unsupervised map of symbol words in myth and literature, with human review."},
    {"id": "ai_act", "label": "EU AI Act Observatory", "href": "#ai-act", "domain": "ai_act",
     "frontend": ["frontend/src/aiact"],
     "description": "Articles, obligations, actors, application dates and changes of the AI Act, from official EU sources."},
    {"id": "philosophy", "label": "Philosophy Atlas", "href": "#philosophy-atlas", "domain": "philosophy",
     "frontend": ["frontend/src/philosophy"],
     "description": "Semantic atlas of public-domain philosophy with dominance metrics and tension lenses."},
    {"id": "concepts", "label": "Concept Constellation", "href": "#concept-constellation", "domain": "concepts",
     "frontend": ["frontend/src/concepts"],
     "description": "Curated concepts read across myth, philosophy, Riksdag speeches and the AI Act, with typed relations."},
]

SHARED = [
    {"id": "quality", "label": "Quality & validity", "path": "platform/quality/evaluate.py",
     "description": "Registered data-quality checks (ISO/IEC 25012-inspired) and analytical validity diagnostics for every product, in one result schema."},
    {"id": "rawstore", "label": "rawstore", "path": "platform/lib/rawstore.py",
     "description": "Immutable raw landing: every fetch stored with URL, time and SHA-256 under warehouse/raw."},
    {"id": "warehouse", "label": "dbt + DuckDB", "path": "platform/dbt_project.yml",
     "description": "One DuckDB warehouse; dbt builds bronze views, silver and gold tables, with tests."},
    {"id": "legal", "label": "EU legal parser", "path": "platform/legal/parse.py",
     "description": "Parses EU acts (Official Journal or consolidated XHTML) into articles, recitals and annexes and compares versions; written for any EU act."},
    {"id": "catalog", "label": "Delivery catalogue", "path": "platform/publish/build_catalog.py",
     "description": "catalog.json and delivery.json: every published file with its hash, format and where it is served from."},
    {"id": "r2", "label": "Cloudflare R2", "path": "platform/publish/upload.py",
     "description": "Object storage for Parquet and document shards; the site reads them through the delivery manifest."},
]
