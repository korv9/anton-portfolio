"""Write the latest welfare run record to object storage as status/welfare-run.json.

The committed welfare/run.json only changes when data does. This copy is replaced on every
scheduled run, uncached, so the status page can show when the pipeline last checked the
sources even on days when nothing moved.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))

from common import PUBLIC  # noqa: E402
from upload import client  # noqa: E402

KEY = "status/welfare-run.json"


def main() -> None:
    body = (PUBLIC / "welfare/run.json").read_bytes()
    s3, bucket = client()
    s3.put_object(Bucket=bucket, Key=KEY, Body=body, ContentType="application/json",
                  CacheControl="no-cache, max-age=0")
    print(f"Published {KEY} ({len(body)} bytes)")


if __name__ == "__main__":
    main()
