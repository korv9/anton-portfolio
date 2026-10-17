"""Synthetic register fixtures only; no real company cohort or network requests."""
import copy
import csv
import json
import sys
from pathlib import Path

import duckdb
import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from compliance_intelligence import cli  # noqa: E402
from compliance_intelligence.cohort import build_cohort, select_cohort, verify_cohort  # noqa: E402
from compliance_intelligence.cohort import populate_database
from compliance_intelligence.registry import (  # noqa: E402
    POLICY, encoded, explore, normalize_snapshot, organization_number, resolve,
)
from compliance_intelligence.sources import (  # noqa: E402
    ROOT, ScbClient, ingest_local, load_snapshot, private_path, verify,
)
from lib.rawstore import sha256  # noqa: E402

STAMP = "2026-10-16T12:00:00+00:00"
REVIEW = {"reviewer_id": "synthetic-test-reviewer", "reviewed_at": STAMP}


def number(index):
    digits = "999" + str(index).zfill(6)
    products = [int(d) * (2 if i % 2 == 0 else 1) for i, d in enumerate(digits)]
    return digits + str((-sum(n // 10 + n % 10 for n in products)) % 10)


def rows(count=55):
    return [{"organization_number": number(i), "registered_legal_name": f"Synthetic company {i} AB",
             "primary_sni_code": "62100", "sni_version": "2025", "active": "1",
             "employee_size_class": "6", "legal_form": "49"} for i in range(count)]


def document():
    return {"document_id": "synthetic-document", "source_id": "synthetic_register",
            "source_url": "https://example.invalid/register", "publisher": "Synthetic register",
            "fetched_at": STAMP, "document_hash": "a" * 64, "content_type": "application/json",
            "byte_count": 1, "path": "unused-test-file"}


def metadata():
    return {"schema_version": 1, "as_of_date": "2026-10-16", "fetched_at": STAMP,
            "source_id": "synthetic_register", "source_url": "https://example.invalid/register",
            "publisher": "Synthetic register", "terms_url": "https://example.invalid/terms",
            "sni_version": "2025", "primary_sni_codes": list(POLICY["primary_sni_codes"]),
            "population_complete": True, "completeness_review": REVIEW, "identity_review": REVIEW,
            "reuse_review": REVIEW, "acquisition_method": "local_extract"}


def snapshot(data=None, *, aliases=None, relationships=None):
    data = copy.deepcopy(data if data is not None else rows())
    for i, row in enumerate(data):
        row.update(source_document_id="synthetic-document", source_locator=f"row:{i+1}")
    return normalize_snapshot(data, [document()], metadata(), verified=True,
                              aliases=aliases, relationships=relationships)


def alias(company, text, *, kind="brand", start="2020-01-01", end=None):
    return {"company_id": company, "alias": text, "alias_type": kind,
            "valid_from": start, "valid_to": end, "source_document_id": "synthetic-document",
            "source_locator": "section:operator", "review_status": "approved", "review": REVIEW}


def relation(child, parent, *, kind="subsidiary_of", start="2020-01-01", end=None):
    return {"company_id": child, "related_company_id": parent, "relationship_type": kind,
            "valid_from": start, "valid_to": end, "source_document_id": "synthetic-document",
            "source_locator": "section:ownership", "review_status": "approved", "review": REVIEW}


def write_local(tmp_path, data=None, *, parquet=False, meta_update=None):
    data = data if data is not None else rows()
    source = tmp_path / ("synthetic.parquet" if parquet else "synthetic.csv")
    if parquet:
        import pyarrow as pa
        import pyarrow.parquet as pq
        pq.write_table(pa.Table.from_pylist(data), source)
    else:
        with source.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(data[0]))
            writer.writeheader()
            writer.writerows(data)
    meta = {**metadata(), "row_count": len(data), "source_sha256": sha256(source.read_bytes()), **(meta_update or {})}
    sidecar = tmp_path / "synthetic.metadata.json"
    sidecar.write_bytes(encoded(meta))
    return source, sidecar


def test_organization_number_formats_and_natural_person_rejection():
    assert organization_number("556016-0680") == "5560160680"
    value = number(123)
    assert organization_number(value[:6] + "-" + value[6:]) == value
    assert organization_number("16" + value) == value
    for invalid in ("199001011234", "9001011234", value[:-1] + str((int(value[-1])+1) % 10), "SE" + value + "01"):
        with pytest.raises(ValueError):
            organization_number(invalid)


def test_private_scb_selection_never_asserts_human_reuse_approval(tmp_path):
    value = snapshot()
    value['metadata'].update(acquisition_method='scb_api_v1',source_id='scb_company_register',reuse_review=None)
    with pytest.raises(ValueError,match='Review source terms'):
        select_cohort(value,'private-scb')
    selected,method,_ = select_cohort(value,'private-scb',private_only=True)
    assert len(selected)==50 and method['selection_scope']=='private_research'
    assert method['source_reuse_status']=='not_reviewed_for_publication'
    assert value['metadata']['reuse_review'] is None
    value['documents'][0]['source_id']='scb_company_register'
    database=tmp_path/'private-registry.duckdb'
    populate_database(database,value)
    with duckdb.connect(str(database),read_only=True) as con:
        assert con.execute('select distinct reuse_status from compliance_intelligence.source_document').fetchall()==[('unverified',)]
    value['metadata']['acquisition_method']='local_extract'
    with pytest.raises(ValueError,match='directly acquired SCB'):
        select_cohort(value,'private-scb',private_only=True)


def test_large_registry_preserves_identity_and_field_evidence(tmp_path):
    database=tmp_path/'large-registry.duckdb'
    populate_database(database,snapshot(rows(1001)))
    with duckdb.connect(str(database),read_only=True) as con:
        assert con.execute('select count(*) from compliance_intelligence.dim_company').fetchone()[0]==1001
        assert con.execute('select count(*) from compliance_intelligence.source_evidence').fetchone()[0]==3003
        assert con.execute('select organization_number from compliance_intelligence.dim_company where company_id=?',
            ['se:orgnr:'+number(0)]).fetchone()[0]==number(0)


def test_cohort_order_and_hash_are_stable_with_duplicates_and_input_order():
    data = rows()
    data[-1]["employee_size_class"] = "16"
    selected, methodology, exclusions = select_cohort(snapshot(data), "synthetic-v1")
    reordered, other, _ = select_cohort(snapshot(list(reversed(data)) + [data[3]]), "synthetic-v1")
    assert len(selected) == 50
    assert selected[0]["organization_number"] == number(54)
    assert [r["company_id"] for r in selected] == [r["company_id"] for r in reordered]
    assert methodology["membership_hash"] == other["membership_hash"]
    assert methodology["boundary_class_population"] == 54
    assert methodology["boundary_class_selected"] == 49
    assert len(exclusions) == 5


@pytest.mark.parametrize("update,reason", [
    ({"legal_form": "holding"}, "ineligible_legal_form"),
    ({"primary_sni_code": "64200"}, "ineligible_primary_industry"),
    ({"entity_kind": "registered_branch"}, "registered_branch"),
    ({"active": False}, "inactive_or_unknown_activity"),
    ({"employee_size_class": "0"}, "unknown_size_class"),
    ({"sni_version": "2007"}, "unreviewed_sni_version"),
])
def test_ineligible_entities_are_excluded_with_reasons(update, reason):
    data = rows()
    data[-1].update(update)
    selected, _, exclusions = select_cohort(snapshot(data), "synthetic-v1")
    assert number(54) not in {r["organization_number"] for r in selected}
    assert any(r["reason"] == reason for r in exclusions)


@pytest.mark.parametrize("change", [
    {"population_complete": False}, {"reuse_review": None},
    {"completeness_review": None}, {"primary_sni_codes": ["62100"]},
])
def test_incomplete_or_unreviewed_populations_cannot_freeze(change):
    value = snapshot()
    value["metadata"].update(change)
    with pytest.raises(ValueError):
        select_cohort(value, "synthetic-v1")


def test_fewer_than_fifty_and_conflicting_names_do_not_produce_a_sample():
    with pytest.raises(ValueError, match="exactly 50"):
        select_cohort(snapshot(rows(49)), "synthetic-v1")
    data = rows()
    data.append({**data[0], "registered_legal_name": "Conflicting synthetic name AB"})
    value = snapshot(data)
    assert value["conflicts"][0]["company_id"] == "se:orgnr:" + number(0)
    assert resolve(value, number=number(0))["status"] == "ambiguous"
    assert resolve(value, number=number(0))["company_id"] is None
    with pytest.raises(ValueError, match="conflicting register"):
        select_cohort(value, "synthetic-v1")


def test_group_members_and_foreign_parents_are_distinct():
    data = rows(3)
    data.append({"country_code": "GB", "registry_authority": "companies_house", "registry_number": "SYNTHETIC-FOREIGN",
                 "registered_legal_name": "Synthetic foreign parent PLC", "legal_form": "PLC"})
    parent = "gb:companies_house:SYNTHETIC-FOREIGN"
    child = "se:orgnr:" + number(0)
    sibling = "se:orgnr:" + number(1)
    value = snapshot(data, relationships=[relation(child, parent), relation(sibling, parent)])
    exact = resolve(value, number=number(0), subject_role="issuer")
    assert exact["company_id"] == child and exact["subject_role"] == "issuer"
    assert exact["candidate_ids"] == [child]
    assert resolve(value, number=number(0), name="Synthetic foreign parent PLC")["status"] == "ambiguous"
    assert resolve(value, name="Synthetic foreign parent PLC")["status"] == "unmatched"
    foreign = resolve(value, country="GB", registry_authority="companies_house", registry_number="SYNTHETIC-FOREIGN")
    assert foreign["company_id"] == parent and foreign["country_code"] == "GB"
    assert next(c for c in value["companies"] if c["company_id"] == parent)["organization_number"] is None


def test_shared_brands_and_legal_names_require_review_without_an_identifier():
    child, other = ("se:orgnr:" + number(i) for i in range(2))
    data = rows(2)
    data[1]["registered_legal_name"] = data[0]["registered_legal_name"]
    value = snapshot(data, aliases=[alias(child, "Shared synthetic brand"), alias(other, "Shared synthetic brand")])
    assert resolve(value, name="Shared synthetic brand")["status"] == "ambiguous"
    assert resolve(value, name=data[0]["registered_legal_name"])["status"] == "ambiguous"
    assert resolve(value, number=number(0), name="Shared synthetic brand")["company_id"] == child
    assert resolve(value, name="Nonexistent brand")["company_id"] is None


def test_renamed_entity_keeps_identity_with_effective_date_checks():
    company = "se:orgnr:" + number(0)
    value = snapshot(rows(1), aliases=[alias(company, "Previous synthetic name AB", kind="historic_legal_name",
                                            start="2018-01-01", end="2022-01-01")])
    assert resolve(value, number=number(0), name="Previous synthetic name AB", on_date="2021-12-31")["company_id"] == company
    assert resolve(value, number=number(0), name="Previous synthetic name AB", on_date="2022-01-01")["status"] == "ambiguous"
    assert resolve(value, number=number(0), name="Synthetic company 0 AB", on_date="2019-01-01")["status"] == "ambiguous"
    assert resolve(value, number=number(0), on_date="2027-01-01")["status"] != "verified"


def test_merger_does_not_rewrite_predecessor_or_inherit_identity():
    before, after = ("se:orgnr:" + number(i) for i in range(2))
    value = snapshot(rows(2), relationships=[relation(before, after, kind="merged_into", start="2025-01-01")])
    assert resolve(value, number=number(0))["company_id"] == before
    assert resolve(value, number=number(1))["company_id"] == after


def test_contradictory_parents_and_cycles_are_rejected():
    a, b, c = ("se:orgnr:" + number(i) for i in range(3))
    with pytest.raises(ValueError, match="Conflicting parent"):
        snapshot(rows(3), relationships=[relation(a, b), relation(a, c)])
    with pytest.raises(ValueError, match="cycle"):
        snapshot(rows(3), relationships=[relation(a, b), relation(b, a)])
    value = snapshot(rows(3), relationships=[relation(a, b, end="2023-01-01"), relation(a, c, start="2023-01-01")])
    assert len(value["relationships"]) == 2


@pytest.mark.parametrize("parquet", [False, True])
def test_file_import_and_database_export_are_reproducible_and_immutable(tmp_path, parquet):
    source, sidecar = write_local(tmp_path, parquet=parquet)
    imported = tmp_path / "imported"
    ingest_local(source, sidecar, imported)
    bundle = tmp_path / "frozen"
    methodology = build_cohort(imported, bundle, "synthetic-v1")
    assert verify_cohort(bundle)["membership_hash"] == methodology["membership_hash"]
    snapshot_hash = sha256((bundle / "artifact-manifest.json").read_bytes())
    candidates = explore(load_snapshot(bundle), "Synthetic", cohort_ids={"se:orgnr:" + number(0)})
    assert candidates and candidates[0]["cohort_member"] is True
    assert sha256((bundle / "artifact-manifest.json").read_bytes()) == snapshot_hash
    with duckdb.connect(str(bundle / "registry.duckdb"), read_only=True) as con:
        assert con.execute("select count(*) from compliance_intelligence.compliance_cohort").fetchone() == (50,)
        assert con.execute("select count(*) from compliance_intelligence.dim_company").fetchone() == (55,)
        assert con.execute("select count(*) from compliance_intelligence.legal_decision").fetchone() == (0,)
        with pytest.raises(duckdb.InvalidInputException):
            con.execute("delete from compliance_intelligence.compliance_cohort")
    with pytest.raises(ValueError, match="already exists"):
        build_cohort(imported, bundle, "synthetic-v1")
    (bundle / "cohort.json").write_text("[]", encoding="utf-8")
    with pytest.raises(ValueError, match="integrity"):
        verify_cohort(bundle)


def test_file_input_requires_hash_row_count_and_legal_form(tmp_path):
    source, sidecar = write_local(tmp_path, meta_update={"source_sha256": "b" * 64})
    with pytest.raises(ValueError, match="SHA-256"):
        ingest_local(source, sidecar, tmp_path / "bad")
    source, sidecar = write_local(tmp_path, meta_update={"row_count": 1})
    with pytest.raises(ValueError, match="row count"):
        ingest_local(source, sidecar, tmp_path / "bad")
    data = rows(1)
    del data[0]["legal_form"]
    source, sidecar = write_local(tmp_path, data)
    with pytest.raises(ValueError, match="legal_form"):
        ingest_local(source, sidecar, tmp_path / "bad")
    assert not (tmp_path / "bad").exists()


def test_scb_csv_header_mapping_and_conflicting_name_columns(tmp_path):
    fields = {"organization_number": "OrgNr", "registered_legal_name": "Namn",
              "primary_sni_code": "PrimarNaringsgren.naringsgren", "employee_size_class": "AnstKl",
              "active": "FtgStat", "legal_form": "Jurform"}
    data = [{fields.get(k, k): v for k, v in r.items()} for r in rows()]
    source, meta = write_local(tmp_path, data)
    imported = ingest_local(source, meta, tmp_path / "scb-columns")
    assert len(imported["companies"]) == 55
    data[0]["registered_legal_name"] = "Conflicting synthetic operator name"
    for row in data[1:]:
        row["registered_legal_name"] = row["Namn"]
    source, meta = write_local(tmp_path, data)
    with pytest.raises(ValueError, match="Conflicting canonical and SCB columns"):
        ingest_local(source, meta, tmp_path / "conflicting-columns")


def test_public_output_roots_and_evidence_traversal_are_rejected(tmp_path):
    for path in (ROOT / "warehouse/compliance", ROOT / "frontend/public/data/compliance", ROOT / "docs/private-data"):
        with pytest.raises(ValueError):
            private_path(path)
    from compliance_intelligence.registry import relative_file
    with pytest.raises(ValueError, match="escapes"):
        relative_file(tmp_path, "../other-evidence")


def test_reviewed_aliases_and_foreign_parent_evidence_are_persisted_separately(tmp_path):
    source, meta = write_local(tmp_path)
    proof = tmp_path / "synthetic-ownership.txt"
    proof.write_text("Synthetic ownership proof; not a real company report", encoding="utf-8")
    doc = {**document(), "document_id": "ownership", "path": proof.name,
           "document_hash": sha256(proof.read_bytes()), "source_id": "synthetic_company_report"}
    child = "se:orgnr:" + number(0)
    parent = "gb:companies_house:SYNTHETIC-FOREIGN"
    brand = {**alias(child, "Synthetic brand"), "source_document_id": "ownership"}
    ownership = {**relation(child, parent), "source_document_id": "ownership"}
    identities = {"documents": [doc], "companies": [
        {"country_code": "GB", "registry_authority": "companies_house", "registry_number": "SYNTHETIC-FOREIGN",
         "registered_legal_name": "Synthetic parent PLC", "legal_form": "PLC", "review": REVIEW,
         "source_document_id": "ownership", "source_locator": "section:registered_parent"}],
         "aliases": [brand], "relationships": [ownership]}
    supplement = tmp_path / "identities.json"
    supplement.write_bytes(encoded(identities))
    ingest_local(source, meta, tmp_path / "snapshot", identities_file=supplement)
    build_cohort(tmp_path / "snapshot", tmp_path / "cohort", "synthetic-group")
    with duckdb.connect(str(tmp_path / "cohort/registry.duckdb"), read_only=True) as con:
        assert con.execute("select company_id from compliance_intelligence.dim_company_alias").fetchall() == [(child,)]
        assert con.execute("select company_id, related_company_id from compliance_intelligence.company_relationship").fetchall() == [(child, parent)]
        assert con.execute("select organization_number from compliance_intelligence.dim_company where company_id = ?", [parent]).fetchone() == (None,)
        assert con.execute("select reuse_status from compliance_intelligence.source_document where source_id = 'synthetic_company_report'").fetchone() == ("unverified",)
        assert con.execute("select reviewer_id from compliance_intelligence.record_review where target_table = 'company_relationship'").fetchone() == (REVIEW["reviewer_id"],)


def test_unreviewed_local_identity_is_searchable_but_cannot_freeze(tmp_path):
    source, meta = write_local(tmp_path, meta_update={"identity_review": None})
    value = ingest_local(source, meta, tmp_path / "snapshot")
    assert explore(value, "Synthetic")[0]["identity_status"] == "unverified"
    assert resolve(value, number=number(0))["status"] == "unverified"
    with pytest.raises(ValueError, match="Only 0 verified"):
        build_cohort(tmp_path / "snapshot", tmp_path / "cohort", "synthetic-unreviewed")
    assert not (tmp_path / "cohort").exists()


class Response:
    def __init__(self, body, status=200):
        self.content = encoded(body)
        self.status_code = status


class FakeScb:
    def __init__(self, data=None, *, drift=False, bad_cursor=False, status=200):
        self.data = data if data is not None else rows(55)
        self.drift, self.bad_cursor, self.status = drift, bad_cursor, status
        self.calls, self.count_calls, self.page_calls = [], 0, {}

    def get(self, url, *, params, headers, timeout, allow_redirects):
        assert timeout == 60 and allow_redirects is False
        self.calls.append((url, dict(params), dict(headers)))
        code = url.split("/naringsgren/")[-1].split("/")[0]
        data = self.data if code == "62100" else []
        if url.endswith("/count"):
            self.count_calls += 1
            return Response({"count": len(data) + (1 if self.drift and self.count_calls % 2 == 0 else 0)}, self.status)
        start, limit = params.get("cursorId", 0), params["limit"]
        if self.bad_cursor:
            start = self.page_calls.get(code, 0) * limit
            self.page_calls[code] = self.page_calls.get(code, 0) + 1
        page = data[start:start+limit]
        items = [{"orgNr": r["organization_number"], "namn": r["registered_legal_name"],
                  "primarNaringsgren": {"naringsgren": code, "rangordning": 1},
                  "anstKl": str(r["employee_size_class"]), "ftgStat": str(r["active"]), "jurform": str(r["legal_form"])}
                 for r in page]
        return Response({"jes": items, "pagination": {"limit": limit, "hasMore": start+limit < len(data),
            "nextCursorId": 1 if self.bad_cursor else start+limit}}, self.status)


def test_scb_uses_documented_cursor_fields_and_never_persists_the_key(tmp_path):
    http = FakeScb()
    client = ScbClient("synthetic-secret-key", http=http, sleep=lambda _: None, clock=lambda: STAMP)
    destination = tmp_path / "scb"
    value = client.ingest(destination, page_size=20, reuse_review=REVIEW)
    assert len(value["companies"]) == 55
    assert len(value["metadata"]["collections"]) == 6
    assert any(call[1].get("cursorId") == 20 for call in http.calls)
    assert all(call[2]["X-API-Key"] == "synthetic-secret-key" for call in http.calls)
    assert all(b"synthetic-secret-key" not in p.read_bytes() for p in destination.rglob("*") if p.is_file())
    assert verify(destination)
    result = build_cohort(destination, tmp_path / "scb-cohort", "synthetic-scb")
    assert result["selected_count"] == 50


@pytest.mark.parametrize("options,error", [
    ({"drift": True}, "count changed"),
    ({"bad_cursor": True}, "cursor repeated"),
    ({"status": 401}, "HTTP 401"),
    ({"status": 302}, "HTTP 302"),
])
def test_scb_incomplete_or_denied_acquisition_leaves_no_snapshot(tmp_path, options, error):
    client = ScbClient("synthetic-key", http=FakeScb(**options), sleep=lambda _: None, clock=lambda: STAMP)
    with pytest.raises(ValueError, match=error):
        client.ingest(tmp_path / "scb", page_size=20)
    assert not (tmp_path / "scb").exists()


def test_scb_page_bound_and_network_errors_fail_closed(tmp_path):
    client = ScbClient("synthetic-key", http=FakeScb(), sleep=lambda _: None, clock=lambda: STAMP)
    with pytest.raises(ValueError, match="page bound"):
        client.ingest(tmp_path / "bound", page_size=20, max_pages=1)

    class NetworkError:
        def get(self, *args, **kwargs):
            raise requests.ConnectionError("synthetic-secret-key")

    client = ScbClient("synthetic-secret-key", http=NetworkError(), sleep=lambda _: None, clock=lambda: STAMP)
    with pytest.raises(ValueError) as caught:
        client.ingest(tmp_path / "network")
    assert "synthetic-secret-key" not in str(caught.value)
    assert not (tmp_path / "network").exists()


def test_cli_missing_access_creates_no_placeholder_and_file_fallback_works(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "load_env", lambda: None)
    for name in ("SCB_API_KEY", "COMPLIANCE_COMPANY_FILE", "COMPLIANCE_COMPANY_METADATA"):
        monkeypatch.delenv(name, raising=False)
    assert cli.main(["status"]) == 0
    assert json.loads(capsys.readouterr().out)["status"] == "awaiting_authorized_data"
    assert cli.main(["ingest", "--output", str(tmp_path / "missing")]) == 2
    assert "SCB_API_KEY is missing" in capsys.readouterr().err
    assert not (tmp_path / "missing").exists()
    source, meta = write_local(tmp_path)
    monkeypatch.setenv("COMPLIANCE_COMPANY_FILE", str(source))
    monkeypatch.setenv("COMPLIANCE_COMPANY_METADATA", str(meta))
    assert cli.main(["ingest", "--output", str(tmp_path / "file-fallback")]) == 0
    assert len(load_snapshot(tmp_path / "file-fallback")["companies"]) == 55
