"""Vertex AI text embeddings for Allegora's whole-SFS search (docs/allegora-gcp.md).

On Cloud Run the access token comes from the metadata server, as the service's own account;
locally from VERTEX_ACCESS_TOKEN (`gcloud auth print-access-token`). No key file is used.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

PROJECT = os.environ.get("GCP_PROJECT", "allegora-513419")
LOCATION = os.environ.get("VERTEX_LOCATION", "europe-west4")
MODEL = os.environ.get("EMBED_MODEL", "text-multilingual-embedding-002")
DIMS = int(os.environ.get("EMBED_DIMS", "256"))
METADATA = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
_token: dict = {"value": None, "until": 0.0}


def token() -> str:
    if value := os.environ.get("VERTEX_ACCESS_TOKEN"):
        return value
    if time.time() < _token["until"]:
        return _token["value"]
    request = urllib.request.Request(METADATA, headers={"Metadata-Flavor": "Google"})
    with urllib.request.urlopen(request, timeout=10) as response:
        answer = json.load(response)
    _token.update(value=answer["access_token"], until=time.time() + answer["expires_in"] - 60)
    return _token["value"]


def embed(texts: list[str], task: str, titles: list[str] | None = None) -> list[list[float]]:
    """One vector of DIMS per text. task: RETRIEVAL_DOCUMENT or RETRIEVAL_QUERY. A request holds
    at most 250 texts and 20,000 tokens; the caller batches. 429 and 5xx are retried."""
    instances = [{"content": t, "task_type": task} | ({"title": titles[i]} if titles else {})
                 for i, t in enumerate(texts)]
    url = (f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/"
           f"{LOCATION}/publishers/google/models/{MODEL}:predict")
    body = json.dumps({"instances": instances,
                       "parameters": {"outputDimensionality": DIMS, "autoTruncate": True}}).encode()
    for attempt in range(8):
        request = urllib.request.Request(url, body, {"Authorization": f"Bearer {token()}",
                                                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                answer = json.load(response)
            return [p["embeddings"]["values"] for p in answer["predictions"]]
        except urllib.error.HTTPError as error:
            if error.code != 429 and error.code < 500 or attempt == 7:
                raise RuntimeError(f"Vertex {error.code}: {error.read()[:300]!r}") from error
        time.sleep(2 ** attempt)
    raise AssertionError("unreachable")
