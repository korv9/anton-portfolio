"""Certificate bundle for data.arbetsformedlingen.se.

Since its certificate was renewed on 2026-11-13 the server sends the leaf without its issuer, so
verification fails ("unable to get local issuer certificate"). VERIFY is certifi's bundle plus
telia-chain.pem, two public certificates fetched from the AIA URLs of the chain:

- Telia RSA OV CA v4 (http://cps.trust.telia.com/teliarsaovcav4.cer, valid to 2048), the issuer
  of the leaf;
- Telia RSA TLS Root CA v3 cross-signed by Telia Root CA v2
  (http://cps.trust.telia.com/teliarsatlsrootcav3.cer, valid to 2043), so the chain also ends in a
  root that older certifi releases carry (2026.01.04 lacks v3; 2026.10.19 has it).

The leaf is still checked against a root in certifi; nothing is skipped. Remove this when the
server sends its intermediate again (openssl s_client -showcerts shows it).
"""
from __future__ import annotations

import tempfile
from pathlib import Path

import certifi

CHAIN = Path(__file__).with_name("telia-chain.pem")


def bundle() -> str:
    path = Path(tempfile.gettempdir()) / "portfolio-af-ca.pem"
    path.write_text(Path(certifi.where()).read_text(encoding="utf-8")
                    + CHAIN.read_text(encoding="utf-8"), encoding="utf-8")
    return str(path)


VERIFY = bundle()
