"""Validate the dbt semantic layer: every semantic model and metric in the manifest `dbt parse`
wrote (platform/target/semantic_manifest.json) must pass MetricFlow's own checks.

dbt parse accepts metric YAML that MetricFlow would later refuse to query (an unknown
measure, a ratio over a missing metric, a time dimension without granularity). This runs the
same validator MetricFlow does, without a warehouse connection.
"""
import json
import sys
from pathlib import Path

from dbt_semantic_interfaces.implementations.semantic_manifest import PydanticSemanticManifest
from dbt_semantic_interfaces.validations.semantic_manifest_validator import SemanticManifestValidator

MANIFEST = Path(__file__).resolve().parents[1] / "target/semantic_manifest.json"


def main() -> None:
    manifest = PydanticSemanticManifest.parse_obj(json.loads(MANIFEST.read_text(encoding="utf-8")))
    result = SemanticManifestValidator[PydanticSemanticManifest]().validate_semantic_manifest(manifest)
    for issue in [*result.errors, *result.warnings]:
        print(issue)
    if result.errors:
        sys.exit(f"{len(result.errors)} semantic layer error(s)")
    print(f"Semantic layer valid: {len(manifest.semantic_models)} semantic models, {len(manifest.metrics)} metrics.")


if __name__ == "__main__":
    main()
