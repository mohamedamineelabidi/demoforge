from __future__ import annotations

import pytest
from pydantic import ValidationError

from demoforge.schemas import (
    Claim,
    Evidence,
    EvidenceCatalog,
    FileRecord,
    Repository,
    validate_claim_support,
)
from tests.schemas.conftest import SHA1, SHA256, TS


def test_round_trip(claim_json: dict) -> None:
    assert Claim.model_validate(claim_json).model_dump(mode="json") == claim_json


def test_requires_nonempty_evidence(claim_json: dict) -> None:
    with pytest.raises(ValidationError):
        Claim.model_validate({**claim_json, "evidence_ids": []})


def test_rejects_blank_text(claim_json: dict) -> None:
    with pytest.raises(ValidationError):
        Claim.model_validate({**claim_json, "text": "   "})


def test_rejects_invalid_status(claim_json: dict) -> None:
    with pytest.raises(ValidationError):
        Claim.model_validate({**claim_json, "verification_status": "approved"})


def test_revision_must_be_positive(claim_json: dict) -> None:
    with pytest.raises(ValidationError):
        Claim.model_validate({**claim_json, "revision": 0})


def _evidence(evidence_id: str, kind: str = "repository", **over) -> Evidence:
    base = {
        "schema_version": 1,
        "evidence_id": evidence_id,
        "kind": kind,
        "source": "README.md" if kind == "repository" else kind,
        "revision": SHA1 if kind == "repository" else None,
        "line_start": 1 if kind == "repository" else None,
        "line_end": 1 if kind == "repository" else None,
        "quote": "q",
        "acquired_at": TS,
        "content_sha256": SHA256,
        "observation_id": "obs_1" if kind == "observation" else None,
        "attestation_id": "att_1" if kind == "attestation" else None,
    }
    return Evidence.model_validate({**base, **over})


def test_dangling_evidence_is_rejected(claim_json: dict) -> None:
    claim = Claim.model_validate({**claim_json, "evidence_ids": ["ev_missing"]})
    errors = validate_claim_support(claim, {"ev_readme_1": _evidence("ev_readme_1")})
    assert any("ev_missing" in e for e in errors)


def test_documented_claim_with_repository_evidence_is_supported(claim_json: dict) -> None:
    claim = Claim.model_validate(claim_json)
    assert validate_claim_support(claim, {"ev_readme_1": _evidence("ev_readme_1")}) == []


def test_runtime_observed_requires_observation_evidence(claim_json: dict) -> None:
    claim = Claim.model_validate({**claim_json, "verification_status": "runtime_observed"})
    errors = validate_claim_support(claim, {"ev_readme_1": _evidence("ev_readme_1")})
    assert errors and "runtime_observed" in errors[0]


def test_runtime_observed_passes_with_observation_evidence(claim_json: dict) -> None:
    claim = Claim.model_validate(
        {
            **claim_json,
            "verification_status": "runtime_observed",
            "evidence_ids": ["ev_readme_1", "ev_obs_1"],
        }
    )
    index = {
        "ev_readme_1": _evidence("ev_readme_1"),
        "ev_obs_1": _evidence("ev_obs_1", kind="observation"),
    }
    assert validate_claim_support(claim, index) == []


def test_user_attested_requires_attestation_evidence(claim_json: dict) -> None:
    claim = Claim.model_validate({**claim_json, "verification_status": "user_attested"})
    assert validate_claim_support(claim, {"ev_readme_1": _evidence("ev_readme_1")})
    ok = Claim.model_validate(
        {**claim_json, "verification_status": "user_attested", "evidence_ids": ["ev_att_1"]}
    )
    assert validate_claim_support(ok, {"ev_att_1": _evidence("ev_att_1", kind="attestation")}) == []


def _catalog_json(evidence_json: dict, claim_json: dict) -> dict:
    return {
        "schema_version": 1,
        "catalog_id": "cat_001",
        "revision": 1,
        "repository": {
            "repo_url": "https://github.com/example/product",
            "full_name": "example/product",
            "commit_sha": SHA1,
            "acquired_at": TS,
            "license": "MIT",
            "metadata_evidence_ids": [],
        },
        "evidence": [evidence_json],
        "claims": [claim_json],
        "assets": [],
        "files": [
            {
                "path": "README.md",
                "classification": "readme",
                "size_bytes": 812,
                "content_sha256": SHA256,
                "scan_status": "clean",
                "exclusion_reason": None,
            }
        ],
    }


def test_catalog_round_trip_and_cross_reference(evidence_json: dict, claim_json: dict) -> None:
    data = _catalog_json(evidence_json, claim_json)
    catalog = EvidenceCatalog.model_validate(data)
    assert catalog.model_dump(mode="json") == data
    assert catalog.support_errors() == []


def test_catalog_rejects_duplicate_evidence_ids(evidence_json: dict, claim_json: dict) -> None:
    data = _catalog_json(evidence_json, claim_json)
    data["evidence"].append(evidence_json)
    with pytest.raises(ValidationError):
        EvidenceCatalog.model_validate(data)


def test_catalog_reports_dangling_claim(evidence_json: dict, claim_json: dict) -> None:
    data = _catalog_json(evidence_json, {**claim_json, "evidence_ids": ["nope"]})
    catalog = EvidenceCatalog.model_validate(data)
    assert catalog.support_errors()


def test_file_record_rejects_escaping_paths() -> None:
    for bad in ["../secret", "/etc/passwd", "C:/Windows/x", "a/../../b"]:
        with pytest.raises(ValidationError):
            FileRecord.model_validate(
                {
                    "path": bad,
                    "classification": "source_code",
                    "size_bytes": 1,
                    "content_sha256": SHA256,
                    "scan_status": "clean",
                    "exclusion_reason": None,
                }
            )


def test_repository_requires_full_commit_sha() -> None:
    with pytest.raises(ValidationError):
        Repository.model_validate(
            {
                "repo_url": "https://github.com/example/product",
                "full_name": "example/product",
                "commit_sha": "main",
                "acquired_at": TS,
                "license": None,
                "metadata_evidence_ids": [],
            }
        )
