"""Shared synthetic fixtures for schema tests. Hashes and text are fixtures, not product claims."""

from __future__ import annotations

import pytest

SHA1 = "a" * 40
SHA256 = "b" * 64
TS = "2026-09-12T10:00:00Z"


@pytest.fixture
def evidence_json() -> dict:
    return {
        "schema_version": 1,
        "evidence_id": "ev_readme_1",
        "kind": "repository",
        "source": "README.md",
        "revision": SHA1,
        "line_start": 12,
        "line_end": 12,
        "quote": "Export results as CSV.",
        "acquired_at": TS,
        "content_sha256": SHA256,
        "observation_id": None,
        "attestation_id": None,
    }


@pytest.fixture
def claim_json() -> dict:
    return {
        "schema_version": 1,
        "claim_id": "claim_csv",
        "revision": 1,
        "text": "Export results as CSV.",
        "evidence_ids": ["ev_readme_1"],
        "verification_status": "documented",
        "limitations": ["Runtime behavior has not been observed."],
    }


@pytest.fixture
def artifact_ref_json() -> dict:
    return {
        "artifact_id": "art_final_mp4",
        "path": "outputs/video/final.mp4",
        "sha256": SHA256,
        "media_type": "video/mp4",
        "size_bytes": 1024,
    }


@pytest.fixture
def manifest_json(artifact_ref_json: dict) -> dict:
    return {
        "schema_version": 1,
        "manifest_id": "man_001",
        "run_id": "run_001",
        "stage_id": "render",
        "attempt_id": "att_001",
        "revision": 1,
        "created_at": TS,
        "input_manifest_ids": ["man_000"],
        "input_hashes": [SHA256],
        "options_hash": SHA256,
        "tool_versions": {"ffmpeg": "9.0"},
        "schema_versions": {"storyboard": 1},
        "template_version": "overlay-v1",
        "model_id": None,
        "prompt_hash": None,
        "outputs": [artifact_ref_json],
        "gate": "pass",
        "cost": {"currency": "USD", "model": None, "compute": None, "storage": None, "total": None},
    }


@pytest.fixture
def approval_json() -> dict:
    return {
        "schema_version": 1,
        "approval_id": "apr_001",
        "run_id": "run_001",
        "subject_type": "storyboard",
        "subject_id": "sb_001",
        "subject_revision": 3,
        "subject_sha256": SHA256,
        "actor_id": "operator:amine",
        "decision": "approved",
        "decided_at": TS,
        "note": None,
    }


@pytest.fixture
def quality_report_json() -> dict:
    return {
        "schema_version": 1,
        "report_id": "qr_001",
        "subject_id": "man_001",
        "subject_revision": 1,
        "gate": "pass",
        "checks": [
            {
                "check_id": "frame_count",
                "status": "pass",
                "required": True,
                "measurement": {"frames": 900},
                "reason": None,
            }
        ],
        "missing_inputs": [],
        "questions": [],
        "warnings": [],
    }
