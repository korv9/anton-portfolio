"""Check the budget context against imported, unmodified gold facts."""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "public/data/gold"


def read(relative):
    return json.loads((GOLD / relative).read_text(encoding="utf-8"))


years = read("marts/budget-context.json")["years"]
frames = read("tables/fact_budget_frame.json")
votes = read("tables/fact_party_vote.json")
points = read("tables/fact_decision_point.json")
counts = Counter((row["session"], row["actor"]) for row in frames)
assert [year["budget_year"] for year in years] == list(range(2015, 2027))
assert {year["budget_year"] for year in years if year["adopted"] == "alternative"} == {2015, 2019, 2022}
assert all(year["comparison_source_url"].startswith("https://data.riksdagen.se/dokument/") for year in years)
for year in years:
    assert all(year["frame_rows"][actor] == counts[(year["session"], actor)] for actor in year["frame_rows"])
    assert all(0 <= count <= 27 for count in year["frame_rows"].values())
    point = next((point for point in points if point["point_id"] == year["decision_point"]), None)
    if year["party_votes"]:
        assert point and point["vote_id"] == year["vote_id"]
        assert len(year["party_votes"]) == 8
        for party_vote in year["party_votes"]:
            source = next(v for v in votes if v["vote_id"] == year["vote_id"] and v["party"] == party_vote["party"])
            assert party_vote["position"] == source["party_position"]
            assert party_vote["yes"] == source["yes_votes"]
            assert party_vote["no"] == source["no_votes"]
            assert party_vote["abstain"] == source["abstain_votes"]
    else:
        assert not year["vote_id"]
    assert not any(year["frame_rows"][party] == 27 for party in year["government_parties"] if year["budget_year"] >= 2023)
print(f"Verified {len(years)} sourced budget years and {sum(len(year['party_votes']) for year in years)} exact party positions.")
