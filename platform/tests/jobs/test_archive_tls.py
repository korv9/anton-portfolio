"""The archive host's bundle is certifi plus the two Telia certificates (archive_tls.py)."""
import sys
from pathlib import Path

import certifi

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingest/jobtech"))

import archive_tls  # noqa: E402


def test_bundle_is_certifi_plus_the_telia_chain():
    bundle = Path(archive_tls.VERIFY).read_text(encoding="utf-8")
    chain = archive_tls.CHAIN.read_text(encoding="utf-8")
    assert bundle.startswith(Path(certifi.where()).read_text(encoding="utf-8"))
    assert bundle.endswith(chain)
    assert chain.count("-----BEGIN CERTIFICATE-----") == 2
