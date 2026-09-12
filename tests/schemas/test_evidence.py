from __future__ import annotations

import pytest
from pydantic import ValidationError

from demoforge.schemas import Evidence
from tests.schemas.conftest import SHA1, SHA256, TS


def test_round_trip(evidence_json: dict) -> None:
    model = Evidence.model_validate(evidence_json)
    assert model.model_dump(mode="json") == evidence_json


def test_rejects_unexpected_field(evidence_json: dict) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "extra": 1})


def test_rejects_unsupported_schema_version(evidence_json: dict) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "schema_version": 2})


def test_rejects_invalid_kind(evidence_json: dict) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "kind": "rumor"})


@pytest.mark.parametrize("bad", ["abc", "A" * 40, "g" * 40, "a" * 39])
def test_repository_revision_must_be_full_commit_hash(evidence_json: dict, bad: str) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "revision": bad})


def test_repository_requires_revision(evidence_json: dict) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "revision": None})


@pytest.mark.parametrize("start,end", [(0, 1), (5, 4), (-1, 3)])
def test_line_range_must_be_positive_and_ordered(evidence_json: dict, start: int, end: int) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "line_start": start, "line_end": end})


def test_repository_requires_line_range(evidence_json: dict) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "line_start": None, "line_end": None})


@pytest.mark.parametrize("bad", ["b" * 63, "B" * 64, "z" * 64])
def test_rejects_bad_sha256(evidence_json: dict, bad: str) -> None:
    with pytest.raises(ValidationError):
        Evidence.model_validate({**evidence_json, "content_sha256": bad})


def test_observation_requires_observation_id() -> None:
    base = {
        "schema_version": 1,
        "evidence_id": "ev_obs_1",
        "kind": "observation",
        "source": "capture",
        "revision": None,
        "line_start": None,
        "line_end": None,
        "quote": "Filter shows 2 completed items.",
        "acquired_at": TS,
        "content_sha256": SHA256,
        "observation_id": None,
        "attestation_id": None,
    }
    with pytest.raises(ValidationError):
        Evidence.model_validate(base)
    ok = Evidence.model_validate({**base, "observation_id": "obs_001"})
    assert ok.observation_id == "obs_001"


def test_attestation_requires_attestation_id() -> None:
    base = {
        "schema_version": 1,
        "evidence_id": "ev_att_1",
        "kind": "attestation",
        "source": "operator",
        "revision": None,
        "line_start": None,
        "line_end": None,
        "quote": "I own this recording.",
        "acquired_at": TS,
        "content_sha256": SHA256,
        "observation_id": None,
        "attestation_id": None,
    }
    with pytest.raises(ValidationError):
        Evidence.model_validate(base)
    assert (
        Evidence.model_validate({**base, "attestation_id": "att_001"}).attestation_id == "att_001"
    )


def test_website_evidence_allows_null_revision_and_lines() -> None:
    model = Evidence.model_validate(
        {
            "schema_version": 1,
            "evidence_id": "ev_web_1",
            "kind": "website",
            "source": "https://example.test/",
            "revision": None,
            "line_start": None,
            "line_end": None,
            "quote": "Tasks, filtered.",
            "acquired_at": TS,
            "content_sha256": SHA256,
            "observation_id": None,
            "attestation_id": None,
        }
    )
    assert model.revision is None


def test_acquired_at_is_utc_and_serializes_with_z(evidence_json: dict) -> None:
    model = Evidence.model_validate({**evidence_json, "acquired_at": "2026-09-12T12:00:00+02:00"})
    assert model.model_dump(mode="json")["acquired_at"] == "2026-09-12T10:00:00Z"
    assert SHA1 == evidence_json["revision"]
