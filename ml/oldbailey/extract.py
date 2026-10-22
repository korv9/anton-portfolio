"""Old Bailey extraction: gemma on Workers AI reads each trial and names its three categories.

    python -m ml.oldbailey.extract [--split sample] [--max-neurons 6000] [--limit N] [--dry-run]

Prompt, model settings and the daily budget are fixed in docs/oldbailey-extraction-preregistration.md.
One call per trial, no retries on content. Each answer is appended to
warehouse/features/oldbailey/gemma-<split>.jsonl ({trial_id, raw, tokens_in, tokens_out, neurons});
trials already there are skipped, so a stopped run resumes. Labels only, no trial text, so the
file may be pushed with warehouse_store.py. Every call adds a line to the Workers AI ledger, and a
run stops when the UTC day's ledger reaches --max-neurons or Cloudflare reports the free
allocation used (4006). CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID come from the environment.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from ml.oldbailey.trials import OUT, REPO

sys.path.insert(0, str(REPO / "platform/nlp"))
sys.path.insert(0, str(REPO / "platform/lib"))
from workers_ai import LEDGER, spent_today  # noqa: E402

MODEL = "@cf/google/gemma-4-26b-a4b-it"
# Neurons per token in and out, as platform/publish/workers_ai/eval_answer.ts (pricing 2026-10-15).
PRICE_IN, PRICE_OUT = 9091e-6, 27273e-6
FEATURES = Path(os.environ.get("PORTFOLIO_FEATURES", REPO / "warehouse/features")) / "oldbailey"
LABELS = {
    "offence": ["theft", "violentTheft", "deception", "kill", "sexual", "breakingPeace", "damage",
                "royalOffences", "miscellaneous"],
    "verdict": ["guilty", "notGuilty", "specialVerdict", "miscVerdict"],
    "punishment": ["death", "transport", "imprison", "corporal", "miscPunish", "noPunish", "none"],
}
SYSTEM = """You label trial reports from the Old Bailey Proceedings (London, 1674-1913).
Answer with one JSON object and nothing else: {"offence": ..., "verdict": ..., "punishment": ...}
Each value must be one of the label names below, spelled exactly (a burglary is "theft").

offence, the charge in the indictment:
- theft: stealing, burglary, housebreaking, pickpocketing, shoplifting, receiving, embezzlement
- violentTheft: robbery, highway robbery
- deception: forgery, fraud, false pretences, perjury, bankruptcy offences
- kill: murder, manslaughter, infanticide
- sexual: rape, bigamy, sodomy, indecent assault, keeping a brothel
- breakingPeace: assault, wounding, riot, libel, threats
- damage: arson and other damage to property
- royalOffences: coining, counterfeit money, treason, sedition, tax offences, religious offences
- miscellaneous: anything else, e.g. returning from transportation, conspiracy, kidnapping
verdict:
- guilty (including pleaded guilty and guilty of a lesser offence), notGuilty,
  specialVerdict (e.g. insane), miscVerdict (any other outcome)
punishment, the sentence stated in the text:
- death, transport, imprison (including penal servitude and hard labour), corporal (whipping,
  pillory), miscPunish (branding, fine, sureties, military service and other), noPunish
  (convicted, then pardoned, respited or discharged)
- none: the defendant was acquitted or not convicted, so there is no sentence"""


def ask(session, text: str) -> dict:
    """One call. Returns the raw answer with tokens and neurons as Cloudflare reports them."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.environ['CLOUDFLARE_ACCOUNT_ID'].strip()}/ai/run/{MODEL}"
    payload = {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}],
               "max_tokens": 80, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False}}
    for attempt in range(6):
        try:
            response = session.post(url, json=payload, timeout=120)
        except OSError:
            time.sleep(2 ** attempt)
            continue
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if response.ok and body.get("success"):
            result = body["result"]
            usage = result.get("usage") or {}
            tokens_in, tokens_out = usage.get("prompt_tokens") or 0, usage.get("completion_tokens") or 0
            raw = result.get("response") or ((result.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            return {"raw": raw.strip(), "tokens_in": tokens_in, "tokens_out": tokens_out,
                    "neurons": float(usage.get("neurons") or tokens_in * PRICE_IN + tokens_out * PRICE_OUT)}
        errors = json.dumps(body.get("errors", []))[:300]
        if "4006" in errors or "daily free allocation" in errors:
            raise QuotaExhausted(errors)
        if response.status_code not in (429, 500, 502, 503, 504):
            raise RuntimeError(f"Workers AI {response.status_code}: {errors}")
        time.sleep(2 ** attempt)
    raise RuntimeError("Workers AI kept failing after 6 attempts")


class QuotaExhausted(Exception):
    pass


def parse(raw: str) -> dict[str, str | None]:
    """The three labels of an answer; a field that is missing or not an allowed label is None."""
    start, end = raw.find("{"), raw.rfind("}")
    try:
        answer = json.loads(raw[start:end + 1]) if start >= 0 else {}
    except ValueError:
        answer = {}
    if not isinstance(answer, dict):
        answer = {}
    return {field: answer.get(field) if answer.get(field) in allowed else None
            for field, allowed in LABELS.items()}


def log(tokens_in: int, tokens_out: int, neurons: float) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("a", encoding="utf-8") as out:
        out.write(json.dumps({"utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                              "agent": "oldbailey", "model": MODEL, "tokens_in": tokens_in,
                              "tokens_out": tokens_out, "neurons_est": round(neurons, 4)}) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="sample", choices=["sample", "dev"])
    parser.add_argument("--max-neurons", type=float, default=6000)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    trials = pd.read_parquet(OUT / "trials.parquet", columns=["trial_id", "split", "text"])
    trials = trials[trials["split"] == args.split].sort_values("trial_id")
    out = FEATURES / f"gemma-{args.split}.jsonl"
    done = set()
    if out.is_file():
        done = {json.loads(line)["trial_id"] for line in out.read_text(encoding="utf-8").splitlines() if line.strip()}
    todo = trials[~trials["trial_id"].isin(done)]
    if args.limit:
        todo = todo.head(args.limit)
    print(f"{len(trials):,} trials, {len(done):,} answered, {len(todo):,} to ask; "
          f"{spent_today():,.0f} neurons in today's ledger", flush=True)
    if args.dry_run or todo.empty:
        return 0
    import requests
    session = requests.Session()
    session.headers["Authorization"] = "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"].strip()
    FEATURES.mkdir(parents=True, exist_ok=True)
    asked = 0
    with out.open("a", encoding="utf-8") as handle:
        for row in todo.itertuples():
            if spent_today() >= args.max_neurons:
                print(f"Stopped at the daily budget of {args.max_neurons:,.0f} neurons", flush=True)
                break
            try:
                answer = ask(session, row.text)
            except QuotaExhausted as error:
                print(f"Stopped: Cloudflare reports the free allocation used ({error})", flush=True)
                break
            log(answer["tokens_in"], answer["tokens_out"], answer["neurons"])
            handle.write(json.dumps({"trial_id": row.trial_id, **answer}, ensure_ascii=False) + "\n")
            handle.flush()
            asked += 1
    print(f"Asked {asked:,}; {len(done) + asked:,} of {len(trials):,} answered", flush=True)
    return 0 if len(done) + asked == len(trials) else 3


if __name__ == "__main__":
    raise SystemExit(main())
