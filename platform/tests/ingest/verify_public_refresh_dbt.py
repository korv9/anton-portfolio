"""Offline rowstore refresh through the real dbt tax models and their existing tests.

Run: python -X utf8 platform/tests/ingest/verify_public_refresh_dbt.py
"""
import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "platform/lib"))
sys.path.insert(0, str(ROOT / "platform/ingest/taxes"))

import duckdb  # noqa: E402
import rawstore  # noqa: E402
import taxes_ingest as taxes  # noqa: E402


class RowstoreFixture:
    calls = 0
    regional_rate = 10

    def get(self, url, **kwargs):
        self.calls += 1
        year = parse_qs(urlsplit(url).query)["år"][0]
        rows = [{"år": year, "kommun": f"Fixture {i}", "församlings-kod": f"{i:04d}01",
                 "församling": f"Fixture {i}", "kommunal-skatt": "22",
                 "landstings-skatt": str(self.regional_rate),
                 "begravnings-avgift": "0.2", "kyrkoavgift": "1"} for i in range(290)]

        class Response:
            content = json.dumps({"resultCount": len(rows), "results": rows}).encode()

            def raise_for_status(self):
                pass

        return Response()


def main():
    (ROOT / "warehouse").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="public-refresh-", dir=ROOT / "warehouse") as directory:
        temp = Path(directory)
        rawstore.RAW = temp / "raw"
        rawstore.time.sleep = lambda _: None
        os.environ["PORTFOLIO_FULL_REFRESH"] = "0"
        http = RowstoreFixture()
        old, current = date.today().year - 3, date.today().year
        for _ in range(2):
            for year in (old, current):
                taxes.rowstore_pages(http, "fixture", f"municipal_rates/part-{year}",
                                     {"år": str(year)}, 90 if year == old else 0)
            http.regional_rate = 11
        assert http.calls == 3, "Second run must download only current data"
        env = dict(os.environ, PORTFOLIO_RAW=str(rawstore.RAW),
                   PORTFOLIO_DB=str(temp / "test.duckdb"), DBT_SEND_ANONYMOUS_USAGE_STATS="false")
        subprocess.run([sys.executable, "-m", "dbt.cli.main", "build", "--profiles-dir", ".",
                        "--select", "+fct_municipal_tax_rate", "assert_municipal_rates_plausible",
                        "--target-path", str(temp / "target")], cwd=ROOT / "platform", env=env, check=True)
        con = duckdb.connect(env["PORTFOLIO_DB"], read_only=True)
        try:
            assert con.execute("select year, count(*), min(local_income_tax_rate) "
                               "from gold.fct_municipal_tax_rate group by year order by year").fetchall() == [
                (old, 290, 32.0), (current, 290, 33.0)]
        finally:
            con.close()
    print("Offline refresh/dbt verified: complete history reused, current rates updated, existing tests passed")


if __name__ == "__main__":
    main()
