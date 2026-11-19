"""Dayparts: an audience index per metro station and hour (pre-registration, descriptive parts).

The 2019 edition counts each station's boardings 06–09, 07.30–08.30, 15–18 and 16.30–17.30. The
rest of the day is the day count minus the two three-hour bands. Inside each band, and over the
rest of the service day, boardings are spread over half-hours in proportion to the station's
scheduled metro departures that half-hour. Only the four bands are counted; the shape inside
them is this model.
"""
from __future__ import annotations

# Half-hour slots after the service day's midnight.
PEAK_AM, AM = (15, 16), (12, 13, 14, 17)
PEAK_PM, PM = (33, 34), (30, 31, 32, 35)
BANDED = set(PEAK_AM + AM + PEAK_PM + PM)


def spread(total: float, slots, departures: dict[int, int]) -> dict[int, float]:
    weights = {s: departures.get(s, 0) for s in slots}
    norm = sum(weights.values())
    if norm == 0:
        return {s: total / len(weights) for s in weights} if weights else {}
    return {s: total * w / norm for s, w in weights.items()}


def halfhours(counts: dict, departures: dict[int, int]) -> dict[int, float]:
    """counts: day, h06_09, h0730_0830, h15_18, h1630_1730 of one station; departures: slot ->
    scheduled departures. Returns slot -> modelled boardings; they sum to the day count."""
    rest = counts["day"] - counts["h06_09"] - counts["h15_18"]
    other = [s for s, d in departures.items() if d and s not in BANDED]
    out: dict[int, float] = {}
    for part in (spread(counts["h0730_0830"], PEAK_AM, departures),
                 spread(counts["h06_09"] - counts["h0730_0830"], AM, departures),
                 spread(counts["h1630_1730"], PEAK_PM, departures),
                 spread(counts["h15_18"] - counts["h1630_1730"], PM, departures),
                 spread(rest, other, departures)):
        for slot, value in part.items():
            out[slot] = out.get(slot, 0.0) + value
    return out


def hours(slots: dict[int, float]) -> dict[int, float]:
    """Clock hour (0–23) -> boardings; GTFS slots after 24:00 fold onto the early hours."""
    out: dict[int, float] = {}
    for slot, value in slots.items():
        out[(slot // 2) % 24] = out.get((slot // 2) % 24, 0.0) + value
    return out


def index(per_station: dict[str, dict[int, float]]) -> tuple[dict[str, dict[int, float]], float]:
    """Index 100 = the mean boardings of all stations' service hours (hours with boardings)."""
    values = [v for hourly in per_station.values() for v in hourly.values() if v > 0]
    mean = sum(values) / len(values)
    return {k: {h: 100 * v / mean for h, v in hourly.items()} for k, hourly in per_station.items()}, mean


def demo() -> None:
    counts = {"day": 1000, "h06_09": 300, "h0730_0830": 120, "h15_18": 250, "h1630_1730": 100}
    departures = {s: 10 for s in range(10, 48)}
    slots = halfhours(counts, departures)
    assert abs(sum(slots.values()) - 1000) < 1e-9
    assert abs(slots[15] + slots[16] - 120) < 1e-9 and abs(sum(slots[s] for s in AM) - 180) < 1e-9
    hourly = hours(slots)
    assert abs(sum(hourly.values()) - 1000) < 1e-9 and set(hourly) == set(range(5, 24))


if __name__ == "__main__":
    demo()
    print("dayparts: demo passed")
