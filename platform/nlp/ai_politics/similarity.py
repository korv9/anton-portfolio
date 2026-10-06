"""Semantic similarity between the AI Act and what the Riksdag says about AI.

    python platform/nlp/ai_politics/similarity.py

Two sets of passages, embedded with one multilingual model (nlp/text/embeddings.py):

- the AI Act: every paragraph of every article of the current consolidated text, in the official
  Swedish version (int_ai_act_provisions), leaving out Articles 102–110, which only amend other
  acts; a numbered paragraph is one passage, a short lead-in is joined to what follows;
- the Riksdag: every speech paragraph that passes the AI gate (int_ai_speech_paragraphs).

For each speech paragraph the three closest AI Act passages are kept, and for each article the
eight closest speech paragraphs. Written to warehouse/features/ai_politics/ (read back by dbt as
a source), with run.json: the model, the counts and a baseline, the similarity of random
speech-article pairs, so a "close" pair can be read against chance.

This is semantic similarity: the passages use related language. It is not evidence that one
influenced the other, that a speech responds to the Act, or that they mean the same.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform" / "nlp" / "text"))

from embeddings import MULTILINGUAL, embed, top_k  # noqa: E402

DATABASE = Path(os.environ.get("PORTFOLIO_DB", ROOT / "warehouse/portfolio.duckdb"))
OUT = Path(os.environ.get("PORTFOLIO_FEATURES", ROOT / "warehouse/features")) / "ai_politics"
SKIP_ARTICLES = {str(n) for n in range(102, 111)}
MIN_CHARS = 60
PER_SPEECH = 3
PER_ARTICLE = 8
SEED = 7


def act_passages(text: str) -> list[str]:
    """An article's paragraphs as passages: a short lead-in joins the line after it."""
    out: list[str] = []
    carry = ""
    for line in text.split("\n"):
        line = f"{carry} {line}".strip() if carry else line
        if len(line) < MIN_CHARS or line.endswith(":"):
            carry = line
            continue
        carry = ""
        out.append(line)
    if carry:
        out.append(carry)
    return out


def main() -> int:
    con = duckdb.connect(str(DATABASE), read_only=True)
    current = con.sql("select celex from silver.int_ai_act_documents where is_current").fetchone()[0]
    articles = con.sql(f"""
        select number, title, text from silver.int_ai_act_provisions
        where version_celex = '{current}' and language = 'sv' and provision_kind = 'article'
        order by position""").df()
    act = [
        {"act_passage_id": f"art_{a.number}:{i}", "article_number": a.number, "passage": i, "text": t}
        for a in articles.itertuples() if a.number not in SKIP_ARTICLES
        for i, t in enumerate(act_passages(a.text))
    ]
    speech = con.sql("""
        select speech_id || ':' || paragraph as speech_passage_id, speech_id, paragraph, text
        from silver.int_ai_speech_paragraphs order by speech_id, paragraph""").df().to_dict("records")
    print(f"Embedding {len(act)} AI Act passages and {len(speech)} speech paragraphs with {MULTILINGUAL} …",
          flush=True)
    act_vec = embed([a["text"] for a in act])
    speech_vec = embed([s["text"] for s in speech])
    sim = speech_vec @ act_vec.T

    # Per speech paragraph: the closest AI Act passages.
    idx, val = top_k(sim, PER_SPEECH)
    by_speech = pd.DataFrame([
        {"speech_passage_id": speech[i]["speech_passage_id"], "speech_id": speech[i]["speech_id"],
         "paragraph": speech[i]["paragraph"], "rank": r + 1,
         "act_passage_id": act[j]["act_passage_id"], "article_number": act[j]["article_number"],
         "act_passage": act[j]["passage"], "similarity": float(val[i, r])}
        for i in range(len(speech)) for r, j in enumerate(idx[i])])

    # Per article: the closest speech paragraphs (best passage of the article for each paragraph).
    article_numbers = sorted({a["article_number"] for a in act}, key=lambda n: (int(re.match(r"\d+", n).group()), n))
    rows = []
    for number in article_numbers:
        cols = [j for j, a in enumerate(act) if a["article_number"] == number]
        best = sim[:, cols].max(axis=1)
        best_col = np.array(cols)[sim[:, cols].argmax(axis=1)]
        for rank, i in enumerate(np.argsort(-best)[:PER_ARTICLE]):
            rows.append({"article_number": number, "rank": rank + 1,
                         "speech_passage_id": speech[i]["speech_passage_id"],
                         "speech_id": speech[i]["speech_id"], "paragraph": speech[i]["paragraph"],
                         "act_passage_id": act[best_col[i]]["act_passage_id"],
                         "act_passage": act[best_col[i]]["passage"], "similarity": float(best[i])})
    by_article = pd.DataFrame(rows)

    rng = np.random.default_rng(SEED)
    random_pairs = sim[rng.integers(0, sim.shape[0], 5000), rng.integers(0, sim.shape[1], 5000)]
    OUT.mkdir(parents=True, exist_ok=True)
    by_speech.to_parquet(OUT / "speech_to_act.parquet", index=False)
    by_article.to_parquet(OUT / "article_to_speech.parquet", index=False)
    pd.DataFrame(act).to_parquet(OUT / "act_passages.parquet", index=False)
    run = {
        "model": MULTILINGUAL,
        "act_version": current,
        "act_language": "sv",
        "act_passages": len(act),
        "speech_paragraphs": len(speech),
        "per_speech": PER_SPEECH,
        "per_article": PER_ARTICLE,
        "baseline_random_pairs": {"n": 5000, "mean": float(random_pairs.mean()),
                                  "p95": float(np.quantile(random_pairs, 0.95))},
        "top1_per_speech": {"mean": float(val[:, 0].mean()), "median": float(np.median(val[:, 0]))},
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    (OUT / "run.json").write_text(json.dumps(run, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(run, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
