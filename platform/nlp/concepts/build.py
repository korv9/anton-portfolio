"""The shared concept layer: four corpora, one model, one set of curated concepts.

    python platform/nlp/concepts/build.py

The portfolio's corpora sit at different stages of the same chain: stories (myth and folklore),
ideas (philosophy), contestation (Riksdag speeches) and codification (the EU AI Act). This stage
puts a balanced sample of each into one vector space and reads every chunk against the curated
concepts in seeds/concepts/concepts.csv. Nothing here is a label: a chunk's closeness to a
concept's anchor sentence is a derived measure, and every published row carries its provenance.

1. Chunks, at most CORPUS_SIZE per corpus, spread evenly over the corpus's documents
   (books, works, years, the Act's provisions) so that no long work or busy year dominates:
   - myth: the context windows of the Symbolic Atlas (silver.int_symbol_occurrences);
   - philosophy: the Philosophy Atlas's passages (silver.int_philosophy_passages);
   - politics: one paragraph per sampled Riksdag speech, the same number per calendar year,
     party speeches only (the chair's procedural lines are left out);
   - law: paragraphs of the current consolidated AI Act in English, grouped to 40-220 words
     (Articles 102-110, which only amend other acts, are left out).
   Each chunk keeps corpus, document, location, source URL, the hash of the source version it
   was read from, and when that source was retrieved.
2. Embeddings with the shared multilingual model (nlp/text/vectors.py). Each concept has an
   English and a Swedish anchor sentence; a chunk is compared with the anchor in its own
   language.
3. Alignment, for every chunk x concept: the cosine similarity; the concept's rank among all
   concepts for that chunk; and a z-score against the same concept in the same corpus. Raw
   similarities differ between corpora (a statute is closer to every abstract anchor than a
   fairy tale is), so comparisons across corpora use the rank (within the chunk) or the
   z-score (within the corpus), never the raw score.
4. Per corpus x concept: how often the concept is a chunk's closest (rank-1 share, chance
   1/28), and the representative chunks: highest z-score among chunks where it ranks in the
   top three.
5. Cross-corpus pairs per concept: the most similar pair between two corpora's representative
   chunks, kept only above the 95th percentile of random pairs between those corpora.
6. Evaluation: how far nearest neighbours stay inside their own corpus or language (raw and
   with each corpus's mean removed), whether each Swedish anchor's nearest English anchor is
   the same concept, and how concentrated each corpus's rank-1 concepts are.

Writes warehouse/features/concepts/ (chunks, alignment, concept_similarity, cross_pairs,
run.json); dbt reads them back. No vector is delivered to the site.
"""
from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "nlp" / "text"))

from vectors import MULTILINGUAL, embed  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
RAW = Path(os.environ.get("PORTFOLIO_RAW", ROOT / "warehouse/raw"))
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "concepts"
SEEDS = ROOT / "platform/seeds/concepts"
CURRENT_ACT = "02024R1689-20260727"
AMENDING_ARTICLES = {str(n) for n in range(102, 111)}

CORPUS_SIZE = 500
MIN_WORDS, MAX_WORDS = 40, 220
TOP_RANK = 3
REPRESENTATIVES = 8
NEIGHBOURS = 10
BASELINE_PAIRS = 4000
SEED = 20261006


def words(text: str) -> int:
    return len(text.split())


def chunk_id(corpus: str, *parts) -> str:
    return corpus + ":" + hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:12]


def spread(frame: pd.DataFrame, by: str, total: int, order: str) -> pd.DataFrame:
    """About `total` rows, the same number per `by` group (fewer if a group is short),
    evenly spaced through each group in `order` (deterministic)."""
    groups = list(frame.groupby(by))
    per = max(1, total // max(1, len(groups)))
    parts = []
    for _, group in groups:
        group = group.sort_values(order)
        if len(group) > per:
            idx = np.unique(np.linspace(0, len(group) - 1, per).round().astype(int))
            group = group.iloc[idx]
        parts.append(group)
    return pd.concat(parts, ignore_index=True)


def group_paragraphs(lines: list[str], min_words: int = MIN_WORDS, max_words: int = MAX_WORDS) -> list[str]:
    """Consecutive lines joined until a chunk reaches min_words; a chunk never exceeds
    max_words (an over-long line is cut at the word limit). A short tail joins the last chunk."""
    chunks, current = [], []
    for line in (l.strip() for l in lines):
        if not line:
            continue
        tokens = line.split()
        while len(tokens) > max_words:
            if current:
                chunks.append(" ".join(current))
                current = []
            chunks.append(" ".join(tokens[:max_words]))
            tokens = tokens[max_words:]
        if len(current) + len(tokens) > max_words and current:
            chunks.append(" ".join(current))
            current = []
        current.extend(tokens)
        if len(current) >= min_words:
            chunks.append(" ".join(current))
            current = []
    if current:
        if chunks and words(chunks[-1]) + len(current) <= max_words:
            chunks[-1] = chunks[-1] + " " + " ".join(current)
        elif len(current) >= min_words // 2:
            chunks.append(" ".join(current))
    return chunks


def middle_paragraph(text: str, key: str) -> tuple[int, str] | None:
    """One paragraph of a speech with at least MIN_WORDS words, chosen by a hash of the speech
    id (not by length or content), or None. The opening address alone is never chosen."""
    paragraphs = [p.strip() for p in text.split("\n") if words(p) >= MIN_WORDS]
    if not paragraphs:
        return None
    i = int(hashlib.sha256(key.encode()).hexdigest(), 16) % len(paragraphs)
    p = paragraphs[i]
    tokens = p.split()
    return i, " ".join(tokens[:MAX_WORDS])


def manifest(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def myth_chunks(con) -> pd.DataFrame:
    corpus = json.loads((ROOT / "platform/ingest/symbolic/corpus.json").read_text(encoding="utf-8"))
    docs = {d["id"]: d for d in corpus["documents"]}
    fetched = {m["path"]: m for m in manifest(RAW / "symbolic/_manifest.jsonl")}
    occ = con.sql("""
        select o.occurrence_id, o.document_id, o.char_start, o.context, d.title, d.source_hash
        from silver.int_symbol_occurrences o join silver.int_symbolic_documents d using (document_id)""").df()
    occ = occ[occ.context.map(words) >= 25].drop_duplicates("context")
    sample = spread(occ, "document_id", CORPUS_SIZE, "char_start")
    rows = []
    for r in sample.itertuples():
        f = fetched.get(f"gutenberg/{r.document_id}.txt", {})
        rows.append({
            "chunk_id": chunk_id("myth", r.occurrence_id), "corpus_id": "myth", "language": "en",
            "document_id": r.document_id, "document_title": r.title,
            "location": f"characters {r.char_start:,} of the cleaned text",
            "source_url": f.get("url") or f"https://www.gutenberg.org/ebooks/{docs[r.document_id]['gutenberg_id']}",
            "source_version": r.source_hash, "retrieved_at": f.get("fetched_at"),
            "period": None, "text": r.context,
        })
    return pd.DataFrame(rows)


def philosophy_chunks(con) -> pd.DataFrame:
    passages = con.sql("""
        select p.passage_id, p.document_id, p.position, p.text, d.title, d.author,
               d.source_url, d.source_hash, d.fetched_at
        from silver.int_philosophy_passages p join gold.dim_philosophy_document d using (document_id)""").df()
    sample = spread(passages, "document_id", CORPUS_SIZE, "position")
    return pd.DataFrame([{
        "chunk_id": chunk_id("philosophy", r.passage_id), "corpus_id": "philosophy", "language": "en",
        "document_id": r.document_id, "document_title": f"{r.author}: {r.title}",
        "location": f"passage {r.position}", "source_url": r.source_url,
        "source_version": r.source_hash, "retrieved_at": str(r.fetched_at), "period": None,
        "text": r.text,
    } for r in sample.itertuples()])


def politics_chunks(con) -> pd.DataFrame:
    fetched = {m["sha256"]: m for m in manifest(RAW / "riksdagen/_manifest.jsonl") if m.get("path", "").startswith("speeches/")}
    years = [y for (y,) in con.sql("select distinct speech_year from silver.int_riksdag_speeches order by 1").fetchall()]
    per_year = CORPUS_SIZE // len(years)
    rows = []
    for year in years:
        # Speeches in a fixed pseudo-random order (a hash of the id), several times the quota
        # since not every speech has a paragraph long enough.
        speeches = con.sql(f"""
            select speech_id, speech_date, speaker, party, debate_title, text, source_url, archive_hash
            from silver.int_riksdag_speeches
            where speech_year = {year} and party is not null and word_count >= {MIN_WORDS}
            order by hash(speech_id || '{SEED}') limit {per_year * 4}""").df()
        taken = 0
        for r in speeches.itertuples():
            chosen = middle_paragraph(r.text, r.speech_id)
            if chosen is None:
                continue
            i, text = chosen
            f = fetched.get(r.archive_hash, {})
            rows.append({
                "chunk_id": chunk_id("politics", r.speech_id, i), "corpus_id": "politics", "language": "sv",
                "document_id": r.speech_id, "document_title": f"{r.speaker} ({r.party}): {r.debate_title}",
                "location": f"paragraph {i + 1} of the speech, {str(r.speech_date)[:10]}",
                "source_url": r.source_url, "source_version": r.archive_hash,
                "retrieved_at": f.get("fetched_at"), "period": str(r.speech_date)[:10], "text": text,
            })
            taken += 1
            if taken >= per_year:
                break
    return pd.DataFrame(rows)


def law_chunks(con) -> pd.DataFrame:
    provisions = con.sql(f"""
        select provision_id, provision_kind, number, position, title, text, source_url, source_hash, retrieved_at
        from silver.int_ai_act_provisions
        where version_celex = '{CURRENT_ACT}' and language = 'en'""").df()
    rows = []
    for r in provisions.itertuples():
        if r.provision_kind == "article" and str(r.number) in AMENDING_ARTICLES:
            continue
        label = f"{'Article' if r.provision_kind == 'article' else 'Annex'} {r.number}"
        for i, text in enumerate(group_paragraphs(r.text.split("\n"))):
            rows.append({
                "chunk_id": chunk_id("law", CURRENT_ACT, r.provision_id, i), "corpus_id": "law", "language": "en",
                "document_id": r.provision_id, "document_title": f"{label}: {r.title or ''}".strip(": "),
                "location": f"{label}, part {i + 1}", "order": r.position * 1000 + i,
                "source_url": r.source_url, "source_version": f"{CURRENT_ACT} ({r.source_hash[:12]})",
                "retrieved_at": str(r.retrieved_at), "period": None, "text": text,
            })
    frame = pd.DataFrame(rows).sort_values("order")
    # One even spread over the whole Act, in reading order.
    idx = np.unique(np.linspace(0, len(frame) - 1, min(CORPUS_SIZE, len(frame))).round().astype(int))
    return frame.iloc[idx].drop(columns="order").reset_index(drop=True)


def same_rate(vectors: np.ndarray, groups: np.ndarray, k: int = NEIGHBOURS) -> float:
    sim = vectors @ vectors.T
    np.fill_diagonal(sim, -np.inf)
    nearest = np.argpartition(-sim, k, axis=1)[:, :k]
    return float((groups[nearest] == groups[:, None]).mean())


def chance(groups: np.ndarray) -> float:
    n = len(groups)
    return float(sum(c * (c - 1) for c in Counter(groups).values()) / (n * (n - 1)))


def centre_by(vectors: np.ndarray, groups: np.ndarray) -> np.ndarray:
    out = vectors.copy()
    for g in np.unique(groups):
        m = groups == g
        out[m] -= out[m].mean(axis=0)
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.where(norms == 0, 1, norms)


def norm_entropy(counts: list[int], n: int) -> float:
    p = np.array([c for c in counts if c]) / max(1, sum(counts))
    return float(-(p * np.log(p)).sum() / np.log(n)) if len(p) > 1 else 0.0


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    concepts = list(csv.DictReader((SEEDS / "concepts.csv").open(encoding="utf-8")))
    ids = [c["concept_id"] for c in concepts]
    builders = {"myth": myth_chunks, "philosophy": philosophy_chunks, "politics": politics_chunks, "law": law_chunks}
    chunks = pd.concat([build(con) for build in builders.values()], ignore_index=True)
    assert chunks.chunk_id.is_unique, "duplicate chunk ids"
    chunks["word_count"] = chunks.text.map(words)
    chunks["retrieved_at"] = pd.to_datetime(chunks.retrieved_at, utc=True, format="mixed").dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    print(chunks.groupby("corpus_id").size().to_dict(), flush=True)

    print(f"Embedding {len(chunks)} chunks and {2 * len(ids)} anchors with {MULTILINGUAL} …", flush=True)
    vectors = embed(chunks.text.tolist())
    anchors = embed([c["anchor_en"] for c in concepts] + [c["anchor_sv"] for c in concepts])
    en, sv = anchors[: len(ids)], anchors[len(ids):]

    swedish = (chunks.language == "sv").to_numpy()
    sim = np.where(swedish[:, None], vectors @ sv.T, vectors @ en.T)
    rank = (-sim).argsort(axis=1).argsort(axis=1) + 1
    corpus = chunks.corpus_id.to_numpy()
    z = np.zeros_like(sim)
    for c in np.unique(corpus):
        m = corpus == c
        z[m] = (sim[m] - sim[m].mean(axis=0)) / sim[m].std(axis=0).clip(min=1e-6)

    alignment = pd.DataFrame({
        "chunk_id": np.repeat(chunks.chunk_id.to_numpy(), len(ids)),
        "corpus_id": np.repeat(corpus, len(ids)),
        "concept_id": np.tile(ids, len(chunks)),
        "similarity": sim.ravel(), "rank": rank.ravel(), "z_score": z.ravel(),
    })
    # Representatives: within the concept's top TOP_RANK for the chunk, highest z in the corpus.
    alignment["representative_rank"] = (
        alignment.where(alignment["rank"] <= TOP_RANK)
        .groupby(["corpus_id", "concept_id"])["z_score"].rank(ascending=False, method="first"))
    alignment.loc[alignment.representative_rank > REPRESENTATIVES, "representative_rank"] = np.nan

    # Concept x concept: anchor similarity in each language, and cross-language agreement.
    concept_similarity = pd.DataFrame([{
        "concept_a": a, "concept_b": b, "similarity_en": float(en[i] @ en[j]),
        "similarity_sv": float(sv[i] @ sv[j]),
    } for i, a in enumerate(ids) for j, b in enumerate(ids) if i < j])
    cross = sv @ en.T
    anchor_agreement = float(np.mean(cross.argmax(axis=1) == np.arange(len(ids))))
    disagreements = [{"sv": ids[i], "nearest_en": ids[int(cross[i].argmax())]}
                     for i in range(len(ids)) if cross[i].argmax() != i]

    # Random cross-corpus pairs as a baseline, then the best pair per concept and corpus pair.
    rng = np.random.default_rng(SEED)
    index = {c: np.where(corpus == c)[0] for c in builders}
    corpora = list(builders)
    baselines, pairs = {}, []
    for x in range(len(corpora)):
        for y in range(x + 1, len(corpora)):
            a, b = corpora[x], corpora[y]
            ra, rb = rng.choice(index[a], BASELINE_PAIRS), rng.choice(index[b], BASELINE_PAIRS)
            s = (vectors[ra] * vectors[rb]).sum(axis=1)
            baselines[f"{a}|{b}"] = {"mean": float(s.mean()), "p95": float(np.quantile(s, 0.95))}
            for concept in ids:
                reps = alignment[(alignment.concept_id == concept) & alignment.representative_rank.notna()]
                ia = chunks.index[chunks.chunk_id.isin(reps[reps.corpus_id == a].chunk_id)]
                ib = chunks.index[chunks.chunk_id.isin(reps[reps.corpus_id == b].chunk_id)]
                if len(ia) == 0 or len(ib) == 0:
                    continue
                m = vectors[ia] @ vectors[ib].T
                i, j = np.unravel_index(m.argmax(), m.shape)
                pairs.append({"concept_id": concept, "corpus_a": a, "corpus_b": b,
                              "chunk_a": chunks.chunk_id[ia[i]], "chunk_b": chunks.chunk_id[ib[j]],
                              "similarity": float(m[i, j]), "baseline_mean": baselines[f"{a}|{b}"]["mean"],
                              "baseline_p95": baselines[f"{a}|{b}"]["p95"],
                              "above_baseline": bool(m[i, j] > baselines[f"{a}|{b}"]["p95"])})
    cross_pairs = pd.DataFrame(pairs)

    language = chunks.language.to_numpy()
    top1 = rank.argmin(axis=1)
    evaluation = {
        "same_corpus_neighbours": same_rate(vectors, corpus), "same_corpus_chance": chance(corpus),
        "same_corpus_neighbours_centred": same_rate(centre_by(vectors, corpus), corpus),
        "same_language_neighbours": same_rate(vectors, language), "same_language_chance": chance(language),
        "anchor_agreement_sv_en": anchor_agreement, "anchor_disagreements": disagreements,
        "rank1_concentration": {
            c: {"entropy": norm_entropy(list(Counter(top1[corpus == c]).values()), len(ids)),
                "top": [[ids[k], v / int((corpus == c).sum())] for k, v in Counter(top1[corpus == c]).most_common(3)]}
            for c in corpora},
        "mean_similarity_by_corpus": {c: float(sim[corpus == c].mean()) for c in corpora},
    }
    print(json.dumps({k: v for k, v in evaluation.items() if k != "rank1_concentration"}, indent=1), flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    chunks.to_parquet(OUT / "chunks.parquet", index=False)
    alignment.to_parquet(OUT / "alignment.parquet", index=False)
    concept_similarity.to_parquet(OUT / "concept_similarity.parquet", index=False)
    cross_pairs.to_parquet(OUT / "cross_pairs.parquet", index=False)
    run = {"model": MULTILINGUAL, "chunks": chunks.groupby("corpus_id").size().to_dict(),
           "corpus_size": CORPUS_SIZE, "words": [MIN_WORDS, MAX_WORDS], "concepts": len(ids),
           "top_rank": TOP_RANK, "representatives": REPRESENTATIVES, "neighbours": NEIGHBOURS,
           "act_version": CURRENT_ACT, "baselines": baselines, "evaluation": evaluation,
           "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    (OUT / "run.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
