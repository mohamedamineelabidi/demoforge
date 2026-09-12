"""Tests for the offline evaluation-fixture format."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from demoforge.evals.schema import EvalCase, EvalMetrics, Permission, load_cases

REPO_ROOT = Path(__file__).resolve().parents[2]
CASES_DIR = REPO_ROOT / "evals" / "cases"

EXPECTED_KINDS = {
    "taskroom_completed_filter": "authorized_recording",
    "invalid_media": "invalid_media",
    "missing_evidence": "missing_evidence",
    "prompt_injection": "prompt_injection",
    "privacy": "privacy",
}


def test_all_cases_load_and_validate() -> None:
    cases = load_cases(CASES_DIR)
    assert len(cases) == 5
    by_id = {c.case_id: c for c in cases}
    assert set(by_id) == set(EXPECTED_KINDS)
    for case_id, kind in EXPECTED_KINDS.items():
        assert by_id[case_id].kind == kind


def test_case_files_round_trip() -> None:
    for path in sorted(CASES_DIR.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        case = EvalCase.model_validate(raw)
        assert case.model_dump(mode="json") == raw, path.name
        assert path.stem == case.case_id


def test_taskroom_case_is_authorized_and_attested() -> None:
    case = {c.case_id: c for c in load_cases(CASES_DIR)}["taskroom_completed_filter"]
    assert case.expected_claims == ["Filter completed tasks"]
    assert case.expected_gate == "pass"
    assert case.permission is not None
    assert case.permission.actor_id == "operator:fixture"
    assert case.inputs["fixture_dir"] == "fixtures/taskroom"


def test_negative_cases_do_not_pass() -> None:
    for case in load_cases(CASES_DIR):
        if case.kind != "authorized_recording":
            assert case.expected_gate in ("ask_user", "fail"), case.case_id


def test_invalid_media_fixture_is_zero_bytes() -> None:
    case = {c.case_id: c for c in load_cases(CASES_DIR)}["invalid_media"]
    media = REPO_ROOT / case.inputs["media_path"]
    assert media.suffix == ".mp4"
    # *.mp4 is gitignored, so a fresh checkout recreates the empty fixture deterministically.
    media.parent.mkdir(parents=True, exist_ok=True)
    if not media.exists():
        media.touch()
    assert media.is_file()
    assert media.stat().st_size == 0


def test_prompt_injection_text_is_data() -> None:
    case = {c.case_id: c for c in load_cases(CASES_DIR)}["prompt_injection"]
    assert "ignore previous instructions" in case.inputs["readme_text"].lower()
    assert case.expected_claims == []


def test_case_rejects_unknown_kind_and_extra_fields() -> None:
    base = {
        "case_id": "x",
        "kind": "privacy",
        "description": "d",
        "inputs": {},
        "expected_claims": [],
        "expected_gate": "fail",
        "permission": None,
    }
    EvalCase.model_validate(base)
    with pytest.raises(ValidationError):
        EvalCase.model_validate({**base, "kind": "anything"})
    with pytest.raises(ValidationError):
        EvalCase.model_validate({**base, "expected_gate": "maybe"})
    with pytest.raises(ValidationError):
        EvalCase.model_validate({**base, "surprise": 1})


def test_permission_requires_timezone() -> None:
    Permission.model_validate(
        {"actor_id": "operator:fixture", "attested_at": "2026-09-12T08:00:00Z", "scope": "s"}
    )
    with pytest.raises(ValidationError):
        Permission.model_validate(
            {"actor_id": "operator:fixture", "attested_at": "2026-09-12T08:00:00", "scope": "s"}
        )


def test_metrics_missing_fields_are_none_not_zero() -> None:
    metrics = EvalMetrics()
    dumped = metrics.model_dump()
    assert set(dumped) == {
        "model_cost_usd",
        "compute_cost_usd",
        "storage_cost_usd",
        "retry_count",
        "correction_time_s",
        "capture_success",
        "render_failure",
        "user_accepted",
    }
    for key, value in dumped.items():
        assert value is None, key
        assert value != 0 or value is None


def test_metrics_accept_explicit_zero() -> None:
    metrics = EvalMetrics(model_cost_usd=0.0, retry_count=0, correction_time_s=0.0)
    assert metrics.model_cost_usd == 0.0
    assert metrics.retry_count == 0
    assert metrics.compute_cost_usd is None
    assert metrics.capture_success is None


def test_metrics_reject_negative_and_non_finite() -> None:
    with pytest.raises(ValidationError):
        EvalMetrics(model_cost_usd=-1.0)
    with pytest.raises(ValidationError):
        EvalMetrics(retry_count=-1)
    with pytest.raises(ValidationError):
        EvalMetrics(correction_time_s=float("inf"))
    with pytest.raises(ValidationError):
        EvalMetrics(capture_success="yes")


def test_load_cases_rejects_missing_dir(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_cases(tmp_path / "nope")
    assert load_cases(tmp_path) == []
