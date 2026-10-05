# Feature engineering and clustering ensemble — 4 October 2026

The current experiment combines **65% cleaned multilingual text embeddings, 15% title
patterns and 20% detected technology mentions**, then takes agreement from three
independent UMAP/HDBSCAN fits. It assigns **5,210 of the same 6,123 ads** to **17 groups**,
leaving **913 (14.91%)** as noise. No group has a majority from one employer. This is a
more useful grouping for technology/role exploration, with explicit tradeoffs in the
original full-text geometry; it is not a validated occupational taxonomy.

## Features and ablations

Eight feature recipes were tested with two UMAP representations (30 neighbours/5D and
60 neighbours/10D), three minimum cluster sizes (40/60/100), two minimum samples (3/5)
and eom/leaf selection: **192 fits**. The [complete candidate table](job-clustering-features.csv)
includes the exactly reused previous input vectors and configuration, not a renormalised
approximation of the baseline. All fits use the full eligible corpus; one fixed 1,200-row
sample supplies pairwise diagnostics, excluding each fit's noise.

| Single fit | Groups | Noise | Largest group | Assigned ads in majority-employer groups | Raw cosine silhouette | Clean cosine silhouette | Own feature cosine silhouette |
|---|---:|---:|---:|---:|---:|---:|---:|
| Previous raw model, 30/5, size 60, samples 5, leaf | 25 | 47.90% | 4.69% | 19.28% | .0739 | .0366 | .0739 |
| Clean text, 30/5, size 100, samples 3, eom | 9 | 49.76% | 11.35% | 0% | .0613 | .0625 | .0625 |
| Clean + title, 60/10, size 100, samples 5, eom | 21 | 13.64% | 9.95% | 0% | −.1008 | −.0988 | .1665 |
| Balanced three-view input, 60/10, size 100, samples 3, eom | 17 | 11.81% | 11.40% | 0% | −.0603 | −.0620 | .1024 |
| More skill weight, 60/10, size 100, samples 3, eom | 13 | 5.41% | 46.32% | 0% | −.0497 | −.0403 | .0548 |
| Additional lexical view, 60/10, size 100, samples 3, eom | 4 | 4.85% | 58.84% | 0% | .0957 | .0809 | .1281 |

The lowest noise solutions restore a giant group and were rejected. Clean + title and
balanced inputs were profiled and checked across seeds. The balanced ensemble was chosen
for more coverage, a moderate largest group, diverse technology profiles and lower
weighted top-employer concentration than the reviewed title-heavy alternative. The old
ranking based on raw-vector silhouette favours the nine-group clean-only fit; it does
not automatically determine the adopted solution.

**The original and cleaned semantic-only silhouettes become negative.** The hybrid defines
similarity partly through title and technology features, so it sacrifices cohesion in
the prior full-text geometry. Own-feature silhouette is positive but modest and is partly
circular because those features construct the clusters. Increased coverage, lower employer
concentration and reproducibility justify an exploratory replacement; they do not prove
better semantic clustering under every definition of similarity. Assigned subsets also
change as noise changes, so scores are not measured on identical retained rows.

### Text cleanup

HTML is converted to text, URLs/emails are removed and descriptions are split into
segments. Repeated nontechnical segments appearing across at least 0.5% of distinct
original text inputs (minimum eight), and selected recruitment/benefit wording, are
removed. Segments mentioning any technology in the existing skill vocabulary are protected,
including negated mentions. If cleaning would empty a description, its text is retained.

3,461 ads lose segments, and 91.5% of original characters remain. Common removed text
includes application invitations, recruitment-test descriptions and repeated staffing-company
introductions. No ads, languages, employers or years are excluded. Local audit Parquet records
removed segments per job ID, and its report records examples and counts. Cleaning remains a
heuristic and may remove meaningful generic/soft-skill content or retain technical boilerplate.

The clean embedding input uses title, cleaned description and detected technologies.
Unlike the original input, it does not append JobTech's separate supplied skill labels
(nonempty in 73 ads); description text remains available. That is another representation
change, not a pure boilerplate-only ablation.

### Feature models

The same pinned multilingual MiniLM encoder is used for 384D cleaned text vectors; no
second neural encoder or paid model service is introduced. The title model uses word
unigrams/bigrams, a token pattern preserving `.NET`, `C++` and `C#`, TF-IDF and a seeded
48D SVD. The technology model reweights the existing 32-label skill bridge with TF-IDF;
it does not duplicate extraction regexes. The lexical-description ablation uses 128D SVD
but was not selected. These transformations follow the documented
[TF-IDF](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html)
and [TruncatedSVD](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.TruncatedSVD.html) APIs.

Each view is L2-normalised, multiplied by the square root of its weight, concatenated,
then normalised again. Thus squared view contributions correspond to the declared weights;
raw block dimension/magnitude does not dominate. The selected input has 464 dimensions.
23.7% of ads have no detected technology mentions; their skill block is zero and the
remaining views are renormalised. Missing mentions are not claims that an ad needs no skills.
Role, seniority, employer, region and year are excluded from features. Title features can
still reproduce title-rule categories and language variants; role cross-tabs are descriptive
and not independent ground truth. Vocabulary/SVD are fitted on the complete exploratory corpus,
not a train/test split for predicting future ads.

## Three-fit consensus and validation

Selected parameters: cosine UMAP, 60 neighbours, 10 dimensions, minimum distance 0;
HDBSCAN minimum cluster size 100, minimum samples 3, eom. Fits at seeds **42/43/44**
are aligned using maximum overlap assignment with
[SciPy's linear assignment solver](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.linear_sum_assignment.html).
Ambiguous ties are rejected; an alternate cluster must have a majority of its overlap in
its matched reference group. A point is assigned only with at least **two votes out of three**.

The reference fit determines the available consensus cluster identities, so new groups
found only in alternate fits may be rejected. Noise can gain an assignment if the other
two fits agree. A consensus group can have fewer points than its component fit's minimum
size because voting removes boundary points. This is a seed ensemble of the same model
family, plus feature fusion; it is not a bagged ensemble of independently trained neural encoders.

The delivered point support is **2/3 or 1 for assigned points, zero for noise**. It is a
vote fraction, not HDBSCAN membership or a calibrated probability that the label is true.
The UI distinguishes this meaning. Profiles use support for representative ads and retain
automatic-label uncertainty. A skill must occur in at least 15% of a group, with lift at
least 1.5, to enter its label; rarer distinctive mentions remain visible in the profile.
This avoids naming a 205-ad frontend group after 17 PHP mentions.

| Ensemble seeds | Groups | Noise | ARI vs chosen ensemble, all rows including noise | ARI on mutually assigned ads |
|---|---:|---:|---:|---:|
| 42/43/44, delivered | 17 | 14.91% | 1 | 1 |
| 43/44/45 | 18 | 14.5% | .877 | .990 |
| 44/45/46 | 17 | 13.0% | .845 | .972 |
| **45/46/47, completely disjoint seeds** | **17** | **15.4%** | **.800** | **.989** |

The first two checks share seeds with the selected ensemble and are optimistic sensitivity
checks. The third uses entirely new seeds. Its common assigned core covers about 81% of
the corpus; high core agreement is not stability of every ad's assigned/noise status.
These are resampled initialisations on one corpus, not cross-year or employer-held-out validation.

Examples of delivered profiles: Python/SQL (234), Snowflake/dbt (699), React/JavaScript
(205), Kubernetes/Docker (157), C++/Linux (526 and 343) and C#/.NET (399).
Two mixed profiles (143 and 405) have weak differentiation. The 143-ad group contains
CNC/CAM and industrial-programming titles already included by the existing source role
rules; it is not silently relabelled as a precise software occupation. Groups can also
split related roles by title/language/technology coverage. Labels remain descriptive.

## Reproduce and deliver

```powershell
ml/.venv/Scripts/python.exe -m ml.jobs.feature_experiment
ml/.venv/Scripts/python.exe -m ml.jobs.feature_experiment --review `
  warehouse/ml/jobs/feature-experiments/ff2856dc431d0f8c/balanced-n60-d10-c100-ms3-eom.json
ml/.venv/Scripts/python.exe -m ml.jobs.feature_experiment --consensus-check `
  warehouse/ml/jobs/feature-experiments/ff2856dc431d0f8c/balanced-n60-d10-c100-ms3-eom.json
ml/.venv/Scripts/python.exe -m ml.jobs.pipeline `
  --revision e8f8c211226b894fcb81acc59f3b34ba3efd5f42 `
  --feature-candidate warehouse/ml/jobs/feature-experiments/ff2856dc431d0f8c/balanced-n60-d10-c100-ms3-eom.json
$env:PORTFOLIO_DB = "$PWD/warehouse/jobtech/history.duckdb"
python -m dbt.cli.main build --project-dir platform --profiles-dir platform `
  --vars '{job_clusters_enabled: true}' --select tag:job_clusters
python platform/publish/export_job_clusters.py
```

The experiment requires the original embedding cache; the normal pipeline creates it if
needed. Feature caches include corpus/text/skill hashes, model revision, implementation and
package versions. Old projections are rejected when experiment package versions differ.
The pipeline verifies corpus, metadata, feature identity, parameters and reviewed assignments
before transactionally updating raw. dbt still owns gold; only compact point/profile data
are exported. Source text, models and feature matrices stay local and gitignored.

The display is an independent 2D UMAP of the fused features, using 60 neighbours, minimum
distance .08 and seed 42. It changes from the prior full-text map; clusters are still fitted
in 10D, not the display. Both original-text and fused-feature neighbour preservation are
reported. The fitted-cluster camera/full-map control uses genuine coordinates. See
[delivery record](editorial-clustering-delivery.md) for the final run identity and checks.
