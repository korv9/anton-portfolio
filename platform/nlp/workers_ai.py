"""Embed a corpus with Cloudflare Workers AI (@cf/baai/bge-m3) over REST, within the free daily quota.

    python platform/nlp/workers_ai.py embed --input corpus.parquet --out warehouse/cluster_lab/<run> \
        [--id-column id] [--text-column text] [--max-tokens-per-run 2000000] [--limit 200] \
        [--agent debate] [--wait-for-reset] [--dry-run]

The input is a parquet or jsonl file with one row per text ({id, text} by default). Vectors are cached
per text hash (digest of the text, as Cluster Lab's io.digest) in
warehouse/cluster_lab/cache/text_vectors/workers-ai-bge-m3/vectors.sqlite, so an interrupted run resumes
where it stopped and a text is never paid for twice. Tokens are counted with the model's own tokenizer
before anything is sent. A run stops at --max-tokens-per-run or when the UTC day's ledger reaches
DAILY_CAP neurons; with --wait-for-reset it then sleeps until 00:05 UTC and continues with a fresh
token cap for the new day.

Every run appends {utc, agent, model, tokens_in, tokens_out, neurons_est} to
warehouse/cluster_lab/workers_ai_ledger.jsonl, with the neurons Cloudflare reports per call. When every
text has a vector, <out>/vectors.npy (float32, input order), ids.json and manifest.json are written;
otherwise the manifest says how many are missing and the exit code is 3.

    python platform/nlp/workers_ai.py compress --run <run folder> --out <corpus folder> [--dims 256]

compress fits PCA on a run's vectors.npy, L2-normalises the projections and stores them as int8 with
one scale per dimension: <out>/pca.json ({model, dims_in, dims, mean, components, scale}) and
<out>/vectors.bin (n x dims int8, ids.json order). It prints recall@10 of that int8 search against
cosine on the full vectors, over 500 random passages of the corpus used as queries.

CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID come from the environment or the repository's .env.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from common import ROOT, load_env  # noqa: E402

MODEL = "@cf/baai/bge-m3"
TOKENIZER = "BAAI/bge-m3"
DIMS = 1024
# Pricing page: bge-m3 costs 1,075 neurons per million input tokens; the free day is 10,000 neurons.
NEURONS_PER_TOKEN = 1075 / 1e6
DAILY_CAP = 9500
BATCH = 100
# One call may hold at most 60,000 tokens, counted as the batch size times its longest text.
BATCH_TOKENS = 40_000
CACHE = ROOT / "warehouse/cluster_lab/cache"
LEDGER = ROOT / "warehouse/cluster_lab/workers_ai_ledger.jsonl"


def text_hash(text: str) -> str:
    return hashlib.sha256(json.dumps(text, ensure_ascii=False).encode()).hexdigest()


def spent_today(ledger: Path = LEDGER, now: datetime | None = None) -> float:
    """Neurons the ledger records for the current UTC day."""
    day = (now or datetime.now(timezone.utc)).date().isoformat()
    if not ledger.is_file():
        return 0.0
    rows = [json.loads(line) for line in ledger.read_text(encoding="utf-8").splitlines() if line.strip()]
    return sum(r.get("neurons_est") or 0 for r in rows if r["utc"][:10] == day)


def affordable(tokens: list[int], max_tokens: int, spent: float, cap: float = DAILY_CAP) -> int:
    """How many of the texts, in order, fit both the run's token cap and the day's remaining neurons."""
    budget = min(max_tokens, max(cap - spent, 0) / NEURONS_PER_TOKEN)
    total = np.cumsum(tokens)
    return int(np.searchsorted(total, budget, side="right"))


def append_ledger(agent: str, tokens: int, neurons: float, ledger: Path = LEDGER) -> None:
    ledger.parent.mkdir(parents=True, exist_ok=True)
    with ledger.open("a", encoding="utf-8") as out:
        out.write(json.dumps({"utc": datetime.now(timezone.utc).isoformat(timespec="seconds"), "agent": agent,
                              "model": MODEL, "tokens_in": tokens, "tokens_out": 0,
                              "neurons_est": round(neurons, 4)}) + "\n")


def count_tokens(texts: list[str]) -> list[int]:
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER, cache_dir=str(CACHE / "models"))
    return [len(ids) for ids in tokenizer(texts, add_special_tokens=True)["input_ids"]]


def read_corpus(path: Path, id_column: str, text_column: str) -> tuple[list[str], list[str]]:
    import pandas as pd
    frame = pd.read_parquet(path) if path.suffix == ".parquet" else pd.read_json(path, lines=True)
    if frame[id_column].duplicated().any():
        raise SystemExit(f"{path}: {id_column} is not unique")
    return frame[id_column].astype(str).tolist(), frame[text_column].astype(str).tolist()


def cache() -> sqlite3.Connection:
    folder = CACHE / "text_vectors/workers-ai-bge-m3"
    folder.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(folder / "vectors.sqlite")
    db.execute("pragma journal_mode=WAL")
    db.execute("create table if not exists vectors (text_hash text primary key, vector blob not null)")
    return db


def cached(db: sqlite3.Connection, hashes: list[str]) -> dict[str, np.ndarray]:
    found = {}
    for start in range(0, len(hashes), 900):
        part = hashes[start:start + 900]
        found.update((h, np.frombuffer(b, dtype="float32")) for h, b in db.execute(
            f"select text_hash, vector from vectors where text_hash in ({','.join('?' * len(part))})", part))
    return found


class QuotaExhausted(Exception):
    pass


def call(session, texts: list[str]) -> tuple[np.ndarray, int, float]:
    """One REST call. Returns (vectors, input tokens, neurons) as Cloudflare reports them."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID']}/ai/run/{MODEL}"
    for attempt in range(6):
        try:
            response = session.post(url, json={"text": texts}, timeout=120)
        except OSError:
            time.sleep(2 ** attempt)
            continue
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if response.ok and body.get("success"):
            result = body["result"]
            meta = result.get("meta") or {}
            vectors = np.asarray(result["data"], dtype="float32")
            if vectors.shape != (len(texts), DIMS):
                raise ValueError(f"Unexpected shape {vectors.shape}")
            tokens = meta.get("cost_metric_value_1") or 0
            return vectors, int(tokens), float(meta.get("neurons") or tokens * NEURONS_PER_TOKEN)
        errors = json.dumps(body.get("errors", []))[:300]
        # 4006: the account has used its daily free allocation.
        if "4006" in errors or "daily free allocation" in errors:
            raise QuotaExhausted(errors)
        if response.status_code not in (429, 500, 502, 503, 504):
            raise RuntimeError(f"Workers AI {response.status_code}: {errors}")
        time.sleep(2 ** attempt)
    raise RuntimeError("Workers AI kept failing after 6 attempts")


def batch_size(lengths: list[int], limit: int = BATCH_TOKENS) -> int:
    """How many of the (ascending) token lengths fit one call: n texts padded to the n-th length."""
    n = 1
    while n < min(len(lengths), BATCH) and (n + 1) * lengths[n] <= limit:
        n += 1
    return n


def next_reset(now: datetime) -> datetime:
    return datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), timezone.utc) + timedelta(minutes=5)


def embed(args) -> int:
    ids, texts = read_corpus(args.input, args.id_column, args.text_column)
    if args.limit:
        ids, texts = ids[:args.limit], texts[:args.limit]
    hashes = [text_hash(t) for t in texts]
    db = cache()
    unique = dict(zip(hashes, texts))
    have = cached(db, list(unique))
    missing = [h for h in unique if h not in have]
    tokens = dict(zip(missing, count_tokens([unique[h] for h in missing]))) if missing else {}
    # Cloudflare bills every text in a batch at the batch's longest length; sorted batches pad little.
    missing.sort(key=tokens.get)
    need = sum(tokens.values())
    print(f"{len(ids):,} texts, {len(unique) - len(missing):,} cached, {len(missing):,} to embed: "
          f"{need:,} tokens, about {need * NEURONS_PER_TOKEN:,.0f} neurons", flush=True)
    sent_tokens, sent_neurons = 0, 0.0
    if missing and not args.dry_run:
        load_env()
        import requests
        session = requests.Session()
        session.headers["Authorization"] = "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"].strip()
        def wait() -> None:
            # Record what this UTC day spent, then sleep into the next one.
            nonlocal sent_tokens, sent_neurons
            append_ledger(args.agent, sent_tokens, sent_neurons)
            sent_tokens, sent_neurons = 0, 0.0
            wake = next_reset(datetime.now(timezone.utc))
            print(f"Daily budget used; waiting until {wake.isoformat()}", flush=True)
            time.sleep(max((wake - datetime.now(timezone.utc)).total_seconds(), 0))

        try:
            while missing:
                fits = affordable([tokens[h] for h in missing], args.max_tokens_per_run - sent_tokens,
                                  spent_today() + sent_neurons)
                if fits == 0:
                    # Only the day's neurons are worth waiting for; the run's token cap is final.
                    cap_reached = affordable([tokens[missing[0]]], 10**12, spent_today() + sent_neurons) > 0
                    if not args.wait_for_reset or cap_reached:
                        break
                    wait()
                    continue
                batch = missing[:min(fits, batch_size([tokens[h] for h in missing[:BATCH]]))]
                try:
                    vectors, used, neurons = call(session, [unique[h] for h in batch])
                except QuotaExhausted as error:
                    print(f"Quota reported exhausted: {error}", flush=True)
                    if not args.wait_for_reset:
                        break
                    wait()
                    continue
                db.executemany("insert or ignore into vectors values (?, ?)",
                               [(h, v.tobytes()) for h, v in zip(batch, vectors)])
                db.commit()
                sent_tokens += used
                sent_neurons += neurons
                missing = missing[len(batch):]
                print(f"  {len(unique) - len(missing):,}/{len(unique):,} embedded, run {sent_tokens:,} tokens, "
                      f"{sent_neurons:,.1f} neurons", flush=True)
        finally:
            if sent_tokens:
                append_ledger(args.agent, sent_tokens, sent_neurons)
    found = cached(db, list(unique))
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {"model": MODEL, "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "input": str(args.input), "texts": len(ids), "unique_texts": len(unique),
                "missing": len(unique) - len(found), "tokens_counted": need,
                "tokens_this_run": sent_tokens, "neurons_this_run": round(sent_neurons, 4),
                "neurons_per_token": NEURONS_PER_TOKEN, "cache": "warehouse/cluster_lab/cache/text_vectors/workers-ai-bge-m3"}
    if len(found) == len(unique) and not args.dry_run:
        np.save(args.out / "vectors.npy", np.stack([found[h] for h in hashes]))
        (args.out / "ids.json").write_text(json.dumps(ids), encoding="utf-8")
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest), flush=True)
    return 0 if manifest["missing"] == 0 else 3


def pca(vectors: np.ndarray, dims: int) -> dict:
    """PCA to `dims`, then L2, then an int8 scale per dimension; numbers rounded as stored in pca.json."""
    mean = vectors.mean(axis=0)
    components = np.linalg.svd(vectors - mean, full_matrices=False)[2][:dims]
    fitted = {"model": MODEL, "dims_in": vectors.shape[1], "dims": dims,
              "mean": np.round(mean, 6).tolist(), "components": np.round(components, 6).tolist()}
    projected = project(vectors, fitted)
    fitted["scale"] = np.round(np.abs(projected).max(axis=0) / 127, 8).tolist()
    return fitted


def project(vectors: np.ndarray, fitted: dict) -> np.ndarray:
    out = (vectors - np.asarray(fitted["mean"], dtype="float32")) @ np.asarray(fitted["components"], dtype="float32").T
    return out / np.linalg.norm(out, axis=1, keepdims=True).clip(min=1e-12)


def quantise(vectors: np.ndarray, fitted: dict) -> np.ndarray:
    return np.round(np.clip(project(vectors, fitted) / np.asarray(fitted["scale"]), -127, 127)).astype("int8")


def recall_at_10(vectors: np.ndarray, fitted: dict, codes: np.ndarray, queries: int = 500, seed: int = 0) -> float:
    """Share of each query's 10 nearest passages (cosine, full vectors) that the int8 search also returns.

    The query itself is left out of both lists, and is projected in float as a visitor's vector would be.
    """
    full = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    rows = np.random.default_rng(seed).choice(len(full), min(queries, len(full)), replace=False)
    corpus = codes.astype("float32") * np.asarray(fitted["scale"], dtype="float32")
    hits = 0
    for start in range(0, len(rows), 100):
        part = rows[start:start + 100]
        exact, approx = full[part] @ full.T, project(vectors[part], fitted) @ corpus.T
        for score in (exact, approx):
            score[np.arange(len(part)), part] = -np.inf
        truth = np.argpartition(-exact, 10, axis=1)[:, :10]
        found = np.argpartition(-approx, 10, axis=1)[:, :10]
        hits += sum(len(set(a) & set(b)) for a, b in zip(truth, found))
    return hits / (10 * len(rows))


def compress(args) -> int:
    vectors = np.load(args.run / "vectors.npy").astype("float32")
    fitted = pca(vectors, args.dims)
    codes = quantise(vectors, fitted)
    recall = recall_at_10(vectors, fitted, codes)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "pca.json").write_text(json.dumps(fitted, separators=(",", ":")), encoding="utf-8")
    codes.tofile(args.out / "vectors.bin")
    print(json.dumps({"dims": args.dims, "n": len(codes), "recall_at_10": round(recall, 4)}), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["embed", "compress"])
    parser.add_argument("--input", type=Path, help="embed: parquet or jsonl with one row per text")
    parser.add_argument("--out", type=Path, required=True,
                        help="embed: run folder for vectors.npy, ids.json, manifest.json; compress: corpus folder")
    parser.add_argument("--run", type=Path, help="compress: a finished embed run folder")
    parser.add_argument("--dims", type=int, default=256, help="compress: PCA dimensions")
    parser.add_argument("--id-column", default="id")
    parser.add_argument("--text-column", default="text")
    parser.add_argument("--max-tokens-per-run", type=int, default=2_000_000)
    parser.add_argument("--limit", type=int, help="only the first N rows (to measure)")
    parser.add_argument("--agent", default="embed", help="name in the ledger")
    parser.add_argument("--wait-for-reset", action="store_true", help="sleep to the next UTC day when the quota is used")
    parser.add_argument("--dry-run", action="store_true", help="count tokens only")
    args = parser.parse_args()
    if args.command == "compress":
        return compress(args)
    if not args.input:
        parser.error("embed needs --input")
    return embed(args)


if __name__ == "__main__":
    sys.exit(main())
