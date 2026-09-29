"""Summarise the week's political news with Claude, grounded in the headlines it is given.

Reads frontend/public/data/parliament/news.json (written by export_news.py), sends the last
seven days of items to Claude with a fixed JSON schema, and keeps only what can be traced:
every theme and party note must cite item ids that were in the input, and a party may only be
named where one of its cited items is tagged with that party. The result is written to
frontend/public/data/parliament/news-summaries.json, which the Nyheter page shows as the
week's summary with links to the articles.

Needs ANTHROPIC_API_KEY (a GitHub secret in the refresh-news workflow). Without it the script
says so and exits 0, so the rest of the refresh still runs.

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
NEWS = ROOT / "frontend/public/data/parliament/news.json"
OUT = ROOT / "frontend/public/data/parliament/news-summaries.json"
PARTIES = ["S", "SD", "M", "V", "C", "KD", "MP", "L"]

SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "themes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "text": {"type": "string"},
                    "parties": {"type": "array", "items": {"type": "string", "enum": PARTIES}},
                    "item_ids": {"type": "array", "items": {"type": "string"}},
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
                    "text": {"type": "string"},
                    "item_ids": {"type": "array", "items": {"type": "string"}},
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
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    items = []
    for item in news.get("items", []):
        published = datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
        if published >= cutoff:
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
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        print("ANTHROPIC_API_KEY is not set; the news summary is left as it was.")
        return 0
    import anthropic  # only needed when a key is set

    news = json.loads(NEWS.read_text(encoding="utf-8"))
    items = recent_items(news, args.days)
    if not items:
        print(f"No news in the last {args.days} days; nothing to summarise.")
        return 0
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

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"].strip())
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
    if response.stop_reason in ("refusal", "max_tokens"):
        print(f"No summary written: the model stopped with {response.stop_reason}.")
        return 1
    text = next(block.text for block in response.content if block.type == "text")
    result = ground(json.loads(text), items)

    dates = sorted(item["published_at"][:10] for item in items)
    OUT.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "model": response.model,
                "period": {"from": dates[0], "to": dates[-1], "days": args.days},
                "items_considered": len(items),
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                },
                **result,
                "method": (
                    "Written by a language model from the headlines and feed summaries of the "
                    "period only, with a fixed JSON schema. Every theme and party note cites "
                    "the items it rests on; citations that were not in the input, and parties "
                    "that the cited items are not tagged with, are removed before publishing."
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        f"Summarised {len(items)} items into {len(result['themes'])} themes and "
        f"{len(result['by_party'])} party notes ({response.usage.input_tokens} in, "
        f"{response.usage.output_tokens} out)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
