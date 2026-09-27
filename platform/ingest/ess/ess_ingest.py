"""Fetch European Social Survey microdata, rounds 1-11, for trust, satisfaction and values.

The ESS data portal (ess.sikt.no) is a front end to Sikt's GraphQL API. A download is a
job: `startDownloadJob` with a data file and a variable list, `pollDownloadJob` until it
returns a short-lived signed URL, then a plain GET. Only the variables below are requested,
intersected with what each main file contains (names shift between rounds: the
region variable is `regionse` for Sweden in rounds 1-4 and NUTS `region` from round 5).

All countries are kept, so Sweden can be read against the Nordics and Europe.

Microdata is ESS ERIC's and stays in the gitignored warehouse. Only weighted aggregates
leave it, cited to ESS ERIC. Writes warehouse/raw/ess/<round>/<datafile>.csv.gz.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))

from rawstore import session, store  # noqa: E402

API = "https://api.nsd.no/graphql"
SOURCE = "ess"
ESS_SERIES_ID = "321b06ad-1b98-4b7d-93ad-ca8a24e8788a"

# Identifiers, weights, background, and the substantive items. See seeds/ess_variables.csv.
VARIABLES = [
    "cntry", "essround", "idno", "anweight", "pspwght", "dweight",
    "gndr", "agea", "region", "regionse",
    "ppltrst", "pplfair", "pplhlp",
    "trstprl", "trstlgl", "trstplc", "trstplt", "trstprt", "trstep", "trstun",
    "stflife", "happy", "stfdem", "stfeco", "stfgov", "stfedu", "stfhlth",
    "health", "sclmeet", "lrscale", "imwbcnt",
]

SERIES_QUERY = """query($id:ID!,$instance:Instance!){search{seriesMetadata(id:$id,instance:$instance,
agencyId:INT_ESSERIC){studies{id version title{en}}}}}"""
FILES_QUERY = """query($id:ID!,$instance:Instance!){search{studyMetadata(id:$id,instance:$instance,
agencyId:INT_ESSERIC){dataFiles{id version isMainFile label{en}}}}}"""
VARIABLES_QUERY = """query($id:ID!,$version:Int,$instance:Instance!){search{dataFileMetadata(id:$id,
version:$version,instance:$instance,agencyId:INT_ESSERIC){variableGroups{variables{name{en}}
variableGroups{variables{name{en}} variableGroups{variables{name{en}}}}}}}}"""
START_QUERY = "query($input:DataFileDownloadInput!){ESS{startDownloadJob(input:$input)}}"
POLL_QUERY = "query($id:ID!){ESS{pollDownloadJob(id:$id){isFinished url}}}"


def graphql(http, query: str, variables: dict) -> dict:
    response = http.post(API, json={"query": query, "variables": variables},
                         headers={"Origin": "https://ess.sikt.no"}, timeout=120)
    response.raise_for_status()
    body = response.json()
    if body.get("errors"):
        raise RuntimeError(f"ESS API error: {body['errors']}")
    return body["data"]


def variable_names(groups) -> set[str]:
    names: set[str] = set()
    for group in groups or []:
        names.update(v["name"]["en"] for v in group.get("variables") or [])
        names |= variable_names(group.get("variableGroups"))
    return names


def download(http, datafile: dict, variables: list[str]) -> tuple[bytes, str, dict]:
    request = {"datafile": {"id": datafile["id"], "version": datafile["version"]},
               "instance": "PUBLISHED", "variables": variables, "format": "CSV",
               "metadataLanguage": "en", "compress": False, "recodeMissingValues": False}
    job = graphql(http, START_QUERY, {"input": request})["ESS"]["startDownloadJob"]
    for _ in range(100):
        state = graphql(http, POLL_QUERY, {"id": job})["ESS"]["pollDownloadJob"]
        if state and state["isFinished"]:
            response = http.get(state["url"], timeout=600)
            response.raise_for_status()
            # The signed query string expires within the hour; record the stable part.
            parts = urlsplit(state["url"])
            return response.content, urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")), request
        time.sleep(3)
    raise TimeoutError(f"ESS download job {job} did not finish")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rounds", nargs="*", type=int, help="Round numbers, default all")
    args = parser.parse_args()
    http = session()
    studies = graphql(http, SERIES_QUERY, {"id": ESS_SERIES_ID, "instance": "PUBLISHED"})
    for study in studies["search"]["seriesMetadata"]["studies"]:
        name = study["title"]["en"]  # "ESS1" ... "ESS11"
        if args.rounds and int(name.removeprefix("ESS")) not in args.rounds:
            continue
        files = graphql(http, FILES_QUERY, {"id": study["id"], "instance": "PUBLISHED"})
        # Usually one main file; ESS10 has a second for countries that switched to
        # self-completion during the pandemic (Sweden among them), marked SC in its label.
        for main_file in (f for f in files["search"]["studyMetadata"]["dataFiles"] if f["isMainFile"]):
            meta = graphql(http, VARIABLES_QUERY, {"id": main_file["id"], "version": main_file["version"],
                                                    "instance": "PUBLISHED"})
            available = variable_names(meta["search"]["dataFileMetadata"]["variableGroups"])
            wanted = [v for v in VARIABLES if v in available]
            payload, url, request = download(http, main_file, wanted)
            label = main_file["label"]["en"]
            store(SOURCE, f"{name}/{label}.csv.gz", payload, url=url, method="GRAPHQL",
                  body={"api": API, "study": study["id"], **request})
            missing = sorted(set(VARIABLES) - set(wanted))
            print(f"ess/{name}: {label}, {len(payload) / 1e6:.1f} MB, not in file: {missing}")

if __name__ == "__main__":
    main()
