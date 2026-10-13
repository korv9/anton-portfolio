"""Summarise the week's political news with Claude, grounded in the headlines it is given.

Reads frontend/public/data/parliament/news.json (written by export_news.py), sends the last
seven days of items to Claude with a fixed JSON schema, and keeps only what can be traced:
every theme and party note must cite item ids that were in the input, and a party may only be
named where one of its cited items is tagged with that party. The result is written to
frontend/public/data/parliament/news-summaries.json, which the Nyheter page shows as the
week's summary with links to the articles.

Exit 0 means generated or skipped, 2 means optional AI failure, and 1 means a local
input/output failure. Every completed attempt prints a JSON status; --status-file also
writes it for the workflow. Failed attempts leave the previous summary and its dates intact.

    pip install anthropic
    python platform/publish/summarize_news.py [--days 7] [--model claude-sonnet-5-5]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "platform/lib"))

from common import read_json, write_bytes_retrying  # noqa: E402
from jsonschema import ValidationError, validate  # noqa: E402

NEWS = ROOT / "frontend/public/data/parliament/news.json"
OUT = ROOT / "frontend/public/data/parliament/news-summaries.json"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string", "pattern": "\\S"},
        "summary": {"type": "string", "pattern": "\\S"},
        "themes": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "pattern": "\\S"},
                    "text": {"type": "string", "pattern": "\\S"},
                    "parties": {"type": "array", "items": {"type": "string", "enum": PARTIES}},
                    "item_ids": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                },
                "required": ["title", "text", "parties", "item_ids"],
                "additionalProperties": False,
            },
        },
        "by_party": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "party": {"type": "string", "enum": PARTIES},
                    "text": {"type": "string", "pattern": "\\S"},
                    "item_ids": {"type": "array", "minItems": 1, "items": {"type": "string"}},
                },
                "required": ["party", "text", "item_ids"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["headline", "summary", "themes", "by_party"],
    "additionalProperties": False,
}

SYSTEM = """Du sammanfattar veckans politiska nyheter i Sverige för en neutral dataprodukt.
Du får bara använda de nyhetsposter du får (rubrik, ingress, källa, datum, partitaggar).
Skriv på svenska, sakligt och utan värderingar. Påstå inget som inte står i posterna.
Varje tema och varje partinotering ska ange id:n för de poster den bygger på.
Nämn ett parti bara om någon av de citerade posterna är taggad med det partiet.
headline: en mening. summary: högst 90 ord. themes: 3–6 teman. by_party: bara partier som
förekommer i posterna, högst två meningar var."""


def recent_items(news: dict, days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    items = []
    for item in news.get("items", []):
        published = datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
        if cutoff <= published <= now:
            items.append(item)
    return items


def ground(result: dict, items: list[dict]) -> dict:
    """Drop every cited id that was not in the input, and every party its citations do not
    carry; drop themes and party notes left without a citation."""
    by_id = {item["id"]: item for item in items}

    def cited(ids: list[str]) -> list[str]:
        return [i for i in dict.fromkeys(ids) if i in by_id]

    themes = []
    for theme in result["themes"]:
        ids = cited(theme["item_ids"])
        if not ids:
            continue
        tagged = {p for i in ids for p in by_id[i].get("parties", [])}
        themes.append({**theme, "item_ids": ids, "parties": [p for p in theme["parties"] if p in tagged]})
    by_party = []
    for note in result["by_party"]:
        ids = [i for i in cited(note["item_ids"]) if note["party"] in by_id[i].get("parties", [])]
        if ids:
            by_party.append({**note, "item_ids": ids})
    return {**result, "themes": themes, "by_party": by_party}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--model", default="claude-sonnet-5-5")
    parser.add_argument("--status-file", type=Path)
    try:
        args = parser.parse_args()
        if args.days <= 0:
            parser.error("--days must be positive")
        if args.status_file and args.status_file.resolve() in (NEWS.resolve(), OUT.resolve()):
            parser.error("--status-file must differ from the news and summary paths")
    except SystemExit as exc:
        return 0 if exc.code == 0 else 1

    status = {
        "schema_version": 1,
        "component": "news_summary",
        "attempted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": args.model,
        "days": args.days,
        "items_considered": 0,
    }

    def finish(state: str, reason: str, code: int, **details) -> int:
        active = None
        try:
            summary = read_json(OUT)
            active = {key: summary.get(key) for key in ("generated_at", "period", "model")}
        except (OSError, ValueError, AttributeError):
            pass
        status.update(status=state, reason=reason, exit_code=code,
                      summary_preserved=state != "generated" and OUT.exists(),
                      active_summary=active, **details)
        if args.status_file:
            try:
                write_bytes_retrying(args.status_file, (json.dumps(status) + "\n").encode("utf-8"))
            except OSError as exc:
                status.update(status="failed", reason="status_output_error", exit_code=1,
                              error_type=type(exc).__name__)
                code = 1
        print(json.dumps(status, ensure_ascii=False))
        return code

    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        print("ANTHROPIC_API_KEY is not set; the news summary is left as it was.", file=sys.stderr)
        return finish("skipped", "no_key", 0)

    try:
        news = read_json(NEWS)
        items = recent_items(news, args.days)
        status.update(news_generated_at=news.get("generated_at"), items_considered=len(items))
        lines = [
            {
                "id": item["id"],
                "source": item["source"],
                "date": item["published_at"][:10],
                "title": item["title"],
                "summary": item.get("summary") or "",
                "parties": item.get("parties", []),
                "topics": item.get("topics", []),
            }
            for item in items
        ]
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        return finish("failed", "input_error", 1, error_type=type(exc).__name__)
    if not items:
        return finish("skipped", "no_recent_items", 0)

    try:
        import anthropic  # only needed when a key and recent items exist
    except ImportError:
        return finish("degraded", "sdk_unavailable", 2)
    try:
        client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"].strip(), timeout=60.0, max_retries=0
        )
        response = client.messages.create(
            model=args.model,
            max_tokens=4000,
            system=SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": "Nyhetsposter (JSON, en per rad):\n"
                    + "\n".join(json.dumps(line, ensure_ascii=False) for line in lines),
                }
            ],
            output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        )
    except Exception as exc:
        # SDK exceptions can include response bodies; report only the type and HTTP code.
        return finish("degraded", "api_error", 2, error_type=type(exc).__name__,
                      http_status=getattr(exc, "status_code", None))
    try:
        if response.stop_reason != "end_turn":
            reason = (response.stop_reason if response.stop_reason in ("refusal", "max_tokens")
                      else "unexpected_stop")
            return finish("degraded", reason, 2, stop_reason=response.stop_reason)
        text = "".join(block.text for block in response.content if block.type == "text")
        result = json.loads(text)
        validate(result, SCHEMA)
        grounded = ground(result, items)
        if not grounded["themes"] or grounded != result:
            return finish("degraded", "ungrounded_response", 2)
        usage = {"input_tokens": response.usage.input_tokens,
                 "output_tokens": response.usage.output_tokens}
        model = response.model
    except (ValueError, KeyError, TypeError, AttributeError, ValidationError) as exc:
        return finish("degraded", "invalid_response", 2, error_type=type(exc).__name__)

    dates = sorted(item["published_at"][:10] for item in items)
    try:
        payload = json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "model": model,
                "period": {"from": dates[0], "to": dates[-1], "days": args.days},
                "items_considered": len(items),
                "usage": usage,
                **result,
                "method": (
                    "Written by a language model from the headlines and feed summaries of the "
                    "period only, with a fixed JSON schema. Every theme and party note cites "
                    "the items it rests on. Results with unknown citations or parties that the "
                    "cited items are not tagged with are rejected before publishing."
                ),
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n"
        OUT.parent.mkdir(parents=True, exist_ok=True)
        write_bytes_retrying(OUT, payload.encode("utf-8"))
    except OSError as exc:
        return finish("failed", "output_error", 1, error_type=type(exc).__name__)
    return finish("generated", "generated", 0)


if __name__ == "__main__":
    sys.exit(main())
