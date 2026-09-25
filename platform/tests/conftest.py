"""Put the ingestion packages on sys.path so their tests import them as siblings do."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for area in ("ingest/riksdagen", "ingest/statskontoret", "lib", "packages"):
    sys.path.insert(0, str(ROOT / area))
