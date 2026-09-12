from __future__ import annotations

import pytest
from pydantic import ValidationError

from demoforge.schemas import ArtifactManifest, ArtifactRef


def test_ref_round_trip(artifact_ref_json: dict) -> None:
    assert (
        ArtifactRef.model_validate(artifact_ref_json).model_dump(mode="json") == artifact_ref_json
    )


@pytest.mark.parametrize(
    "bad",
    [
        "/abs/final.mp4",
        "C:/abs/final.mp4",
        "../outside.mp4",
        "outputs/../../x",
        "outputs\\..\\x",
        "",
    ],
)
def test_ref_rejects_absolute_or_traversing_paths(artifact_ref_json: dict, bad: str) -> None:
    with pytest.raises(ValidationError):
        ArtifactRef.model_validate({**artifact_ref_json, "path": bad})


def test_ref_rejects_url_paths(artifact_ref_json: dict) -> None:
    with pytest.raises(ValidationError):
        ArtifactRef.model_validate({**artifact_ref_json, "path": "https://x.test/signed?sig=1"})


def test_ref_rejects_negative_size_and_bad_hash(artifact_ref_json: dict) -> None:
    with pytest.raises(ValidationError):
        ArtifactRef.model_validate({**artifact_ref_json, "size_bytes": -1})
    with pytest.raises(ValidationError):
        ArtifactRef.model_validate({**artifact_ref_json, "sha256": "short"})


def test_manifest_round_trip(manifest_json: dict) -> None:
    model = ArtifactManifest.model_validate(manifest_json)
    assert model.model_dump(mode="json") == manifest_json


def test_manifest_unknown_cost_is_null_not_zero(manifest_json: dict) -> None:
    model = ArtifactManifest.model_validate(manifest_json)
    assert model.cost.total is None


def test_manifest_rejects_negative_cost(manifest_json: dict) -> None:
    cost = {**manifest_json["cost"], "total": -0.5}
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate({**manifest_json, "cost": cost})


def test_manifest_rejects_non_finite_cost(manifest_json: dict) -> None:
    cost = {**manifest_json["cost"], "compute": float("inf")}
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate({**manifest_json, "cost": cost})


def test_manifest_rejects_duplicate_output_ids(manifest_json: dict) -> None:
    outputs = [manifest_json["outputs"][0], manifest_json["outputs"][0]]
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate({**manifest_json, "outputs": outputs})


def test_manifest_with_passing_gate_needs_outputs(manifest_json: dict) -> None:
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate({**manifest_json, "outputs": []})


def test_failed_manifest_must_not_carry_outputs(manifest_json: dict) -> None:
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate({**manifest_json, "gate": "fail"})
    ok = ArtifactManifest.model_validate({**manifest_json, "gate": "fail", "outputs": []})
    assert ok.outputs == []
