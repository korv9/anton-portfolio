"""Workers AI for the job assistant, inside its own daily neuron budget.

bge-m3 embeds every ad text once (cached per text hash) and the profile; gemma writes a short
explanation for the top new candidates. Both go through platform/nlp/workers_ai.py's REST call and
ledger, with the agent name job-assistant and the ledger under warehouse/raw/job_assistant, so this
project's spend is counted on its own. When the project cap (CAP) or the account's free allocation is
used up, or a call fails, the run goes on without AI: rules and cached vectors still rank every ad,
and the missing vectors and explanations are made on a later run. An explanation is kept only if
every sentence quotes the ad or the CV and every quote is found there.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime, timezone

import numpy as np

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "nlp"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workers_ai  # noqa: E402
from ads import store_dir  # noqa: E402

AGENT = "job-assistant"
CAP = 1500  # neurons per UTC day for this project, of the 10,000 the account shares
EXPLAIN_MODEL = "@cf/google/gemma-4-26b-a4b-it"
# Neurons per token, fitted to the measured 30.2 neurons for 2,341 in and 331 out (docs/workers-ai.md).
GEMMA_IN, GEMMA_OUT = 9091 / 1e6, 27273 / 1e6
EXPLAIN_PER_DAY = 12
TEXT_CHARS = 1500
SYSTEM = " ".join([
    "You explain to a job seeker how one job ad compares with their CV, using only the judgements given.",
    "Write at most three sentences in English. Name what fits and the main gap.",
    'Quote the ad or the CV word for word inside double quotes for every claim, like "Python och SQL".',
    "Never add a skill or experience that is not in the judgements, and never estimate a chance of being hired.",
])


def ledger() -> Path:
    return store_dir() / "ledger.jsonl"


def spent() -> float:
    return workers_ai.spent_today(ledger())


def session():
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token or not os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip():
        return None
    import requests
    http = requests.Session()
    http.headers["Authorization"] = "Bearer " + token
    return http


def ad_text(ad: dict) -> str:
    return (ad.get("headline") or "") + "\n" + (ad.get("description") or "")[:TEXT_CHARS]


def profile_text(profile: dict) -> str:
    parts = [profile["summary"]]
    for section in ("experience", "projects"):
        for item in profile[section]:
            parts += [item["quote"], *item["details"]]
    return "\n".join(parts)[:6000]


def vectors(texts: dict[str, str], http, note: dict) -> dict[str, np.ndarray]:
    """Vectors for {key: text}, from the cache and, within the budget, from bge-m3."""
    path = store_dir() / "vectors.sqlite"
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.execute("create table if not exists vectors (text_hash text primary key, vector blob not null)")
    hashes = {k: workers_ai.text_hash(t) for k, t in texts.items()}
    have = workers_ai.cached(db, list(set(hashes.values())))
    missing = sorted({h for h in hashes.values() if h not in have})
    by_hash = {hashes[k]: texts[k] for k in texts}
    note.update(cached=len(have), missing=len(missing), embedded=0)
    while missing and http is not None:
        # No tokenizer here: three characters per token overestimates Swedish and English text.
        tokens = [len(by_hash[h]) // 3 + 2 for h in missing[:workers_ai.BATCH]]
        fits = workers_ai.affordable(tokens, 10**9, spent(), CAP)
        if fits == 0:
            note["stopped"] = "project budget"
            break
        batch = missing[:min(fits, workers_ai.batch_size(sorted(tokens)))]
        try:
            found, used, neurons = workers_ai.call(http, [by_hash[h] for h in batch])
        except workers_ai.QuotaExhausted:
            note["stopped"] = "account quota"
            break
        except (RuntimeError, OSError) as error:  # a 5xx after retries, or the connection
            note["stopped"] = "error"
            note["error"] = type(error).__name__
            break
        workers_ai.append_ledger(AGENT, used, neurons, ledger())
        db.executemany("insert or ignore into vectors values (?, ?)", [(h, v.tobytes()) for h, v in zip(batch, found)])
        db.commit()
        have.update(zip(batch, found))
        missing = missing[len(batch):]
        note["embedded"] += len(batch)
    db.close()
    return {k: have[h] for k, h in hashes.items() if h in have}


def similarity(ad_vectors: dict[str, np.ndarray], profile_vector: np.ndarray | None) -> dict[str, float]:
    if profile_vector is None:
        return {}
    p = profile_vector / np.linalg.norm(profile_vector)
    return {k: round(float(v @ p / np.linalg.norm(v)), 4) for k, v in ad_vectors.items()}


def fold(text: str) -> str:
    return " ".join(text.replace("“", '"').replace("”", '"').split()).casefold()


def verified(answer: str, sources: list[str]) -> list[str] | None:
    """The answer's quotes when every sentence has one and every one is found in a source; else None."""
    answer = answer.replace("“", '"').replace("”", '"')
    quotes = re.findall(r'"([^"]{3,})"', answer)
    pool = [fold(s) for s in sources]
    # A sentence without a quote is a claim nobody checked.
    masked = re.sub(r'"[^"]{3,}"', "\0", answer)
    claims = [s for s in re.split(r"(?<=[.!?])\s+", masked) if s.strip()]
    if not quotes or not all("\0" in s for s in claims) or not all(any(fold(q) in s for s in pool) for q in quotes):
        return None
    return quotes


def explain(match: dict, ad: dict, http, explained_today: int, now: datetime | None = None) -> dict | None:
    """A checked explanation of one match, or None when the budget or the quota says no. A failed call
    raises RuntimeError (or the connection's OSError), so the caller can record why it stopped."""
    if http is None or explained_today >= EXPLAIN_PER_DAY:
        return None
    facts = {"role": match["role"], "class": match["class"], "reasons": match["reasons"],
             "skills": [{k: j[k] for k in ("skill", "strength", "cv_level", "ad_quotes", "cv_quotes")}
                        for j in match["skills"]], "gaps": match["gaps"], "checks": match["checks"]}
    prompt = json.dumps(facts, ensure_ascii=False)
    estimate = (len(SYSTEM) + len(prompt)) // 3 * GEMMA_IN + 300 * GEMMA_OUT
    if spent() + estimate > CAP:
        return None
    url = (f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID'].strip()}"
           f"/ai/run/{EXPLAIN_MODEL}")
    response = http.post(url, timeout=120, json={
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        "max_tokens": 300, "temperature": 0.1, "chat_template_kwargs": {"enable_thinking": False}})
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not (response.ok and body.get("success")):
        if any(e.get("code") == 4006 for e in body.get("errors") or []):
            return None
        raise RuntimeError(f"Workers AI {response.status_code}")
    result = body["result"]
    text = (result.get("response") or ((result.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    usage = result.get("usage") or {}
    tokens_in, tokens_out = int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0)
    workers_ai.append_ledger(AGENT, tokens_in, tokens_in * GEMMA_IN + tokens_out * GEMMA_OUT, ledger(),
                             model=EXPLAIN_MODEL, tokens_out=tokens_out)
    sources = [ad.get("description") or "", ad.get("headline") or ""] + [
        q["quote"] for j in match["skills"] for q in j["cv_quotes"]]
    quotes = verified(text, sources)
    # Every made explanation counts toward EXPLAIN_PER_DAY, checked or not.
    at = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    if quotes is None:
        return {"status": "unverified", "model": EXPLAIN_MODEL, "at": at}
    return {"status": "verified", "text": text, "quotes": quotes, "model": EXPLAIN_MODEL, "at": at}
