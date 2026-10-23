"""Old Bailey extraction: gemma on Workers AI reads each trial and names its three categories.

    python -m ml.oldbailey.extract [--split sample] [--max-neurons 6000] [--limit N] [--dry-run]

Prompt, model settings and the daily budget are fixed in docs/oldbailey-extraction-preregistration.md.
One call per trial, no retries on content. Each answer is appended to
warehouse/features/oldbailey/gemma-<split>.jsonl as {trial_id, offence, verdict, punishment,
tokens_in, tokens_out, neurons}: the parsed labels (None for a missing or unknown label), not the
model's reply. Trials already there are skipped, so a stopped run resumes; a cut-off last line is
dropped first. No trial text, so the file may be pushed with warehouse_store.py. A lock file in
warehouse/ml/oldbailey/ stops a second runner. Every call adds a line to the Workers AI ledger, and a run stops
when the UTC day's ledger reaches --max-neurons or Cloudflare reports the free allocation used
(4006). CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID come from the environment.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd

from ml.oldbailey.trials import OUT, REPO

sys.path.insert(0, str(REPO / "platform/nlp"))
sys.path.insert(0, str(REPO / "platform/lib"))
from workers_ai import QuotaExhausted, append_ledger, post, spent_today  # noqa: E402

MODEL = "@cf/google/gemma-4-26b-a4b-it"
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
    """One call. Returns the parsed labels with tokens and neurons as Cloudflare reports them."""
    result = post(session, MODEL, {
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}],
        "max_tokens": 80, "temperature": 0, "chat_template_kwargs": {"enable_thinking": False}})
    usage = result.get("usage") or {}
    if usage.get("neurons") is None:
        raise RuntimeError("Workers AI reported no neurons for the call")
    raw = result.get("response") or ((result.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    return {**parse(raw), "tokens_in": usage.get("prompt_tokens") or 0,
            "tokens_out": usage.get("completion_tokens") or 0, "neurons": float(usage["neurons"])}


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


def answered(path: Path) -> set[str]:
    """Trial ids already in the answers file. A cut-off last line (a run stopped mid-write) is removed."""
    if not path.is_file():
        return set()
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    if lines and not lines[-1].endswith("\n"):
        lines.pop()
        path.write_text("".join(lines), encoding="utf-8", newline="\n")
    return {json.loads(line)["trial_id"] for line in lines if line.strip()}


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
    lock = OUT / f"gemma-{args.split}.lock"
    if lock.exists():
        raise SystemExit(f"{lock} exists: another run is answering this split (delete the file if none is)")
    done = answered(out)
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
    try:
        lock.open("x").close()
    except FileExistsError:
        raise SystemExit(f"{lock} exists: another run is answering this split") from None
    try:
        asked = run(session, todo, out, args.max_neurons)
    finally:
        lock.unlink()
    print(f"Asked {asked:,}; {len(done) + asked:,} of {len(trials):,} answered", flush=True)
    return 0 if len(done) + asked == len(trials) else 3


def run(session, todo: pd.DataFrame, out: Path, max_neurons: float) -> int:
    asked = 0
    with out.open("a", encoding="utf-8", newline="\n") as handle:
        for row in todo.itertuples():
            if spent_today() >= max_neurons:
                print(f"Stopped at the daily budget of {max_neurons:,.0f} neurons", flush=True)
                break
            try:
                answer = ask(session, row.text)
            except QuotaExhausted as error:
                print(f"Stopped: Cloudflare reports the free allocation used ({error})", flush=True)
                break
            append_ledger("oldbailey", answer["tokens_in"], answer["neurons"], model=MODEL,
                          tokens_out=answer["tokens_out"])
            handle.write(json.dumps({"trial_id": row.trial_id, **answer}, ensure_ascii=False) + "\n")
            handle.flush()
            asked += 1
    return asked


if __name__ == "__main__":
    raise SystemExit(main())
