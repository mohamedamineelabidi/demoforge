from __future__ import annotations

import pytest
from pydantic import ValidationError

from demoforge.schemas import QualityReport


def test_round_trip(quality_report_json: dict) -> None:
    model = QualityReport.model_validate(quality_report_json)
    assert model.model_dump(mode="json") == quality_report_json


def test_rejects_invalid_gate_and_status(quality_report_json: dict) -> None:
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "gate": "ok"})
    check = {**quality_report_json["checks"][0], "status": "skipped"}
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "checks": [check]})


def test_pass_gate_with_failed_required_check_is_invalid(quality_report_json: dict) -> None:
    check = {**quality_report_json["checks"][0], "status": "fail", "reason": "899 frames"}
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "checks": [check]})


def test_pass_gate_with_required_check_not_run_is_invalid(quality_report_json: dict) -> None:
    check = {**quality_report_json["checks"][0], "status": "not_run"}
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "checks": [check]})


def test_failed_optional_check_allows_pass(quality_report_json: dict) -> None:
    check = {
        "check_id": "contact_sheet",
        "status": "fail",
        "required": False,
        "measurement": None,
        "reason": "renderer unavailable",
    }
    checks = [*quality_report_json["checks"], check]
    model = QualityReport.model_validate({**quality_report_json, "checks": checks})
    assert model.gate == "pass"
    assert model.blocks_completion() is False


def test_fail_gate_blocks_completion(quality_report_json: dict) -> None:
    check = {**quality_report_json["checks"][0], "status": "fail", "reason": "decode error"}
    model = QualityReport.model_validate({**quality_report_json, "gate": "fail", "checks": [check]})
    assert model.blocks_completion() is True


def test_ask_user_requires_questions(quality_report_json: dict) -> None:
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "gate": "ask_user"})
    model = QualityReport.model_validate(
        {**quality_report_json, "gate": "ask_user", "questions": ["Who owns the footage?"]}
    )
    assert model.blocks_completion() is True


def test_rejects_duplicate_check_ids(quality_report_json: dict) -> None:
    checks = [quality_report_json["checks"][0], quality_report_json["checks"][0]]
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "checks": checks})


def test_report_never_stores_secret_values(quality_report_json: dict) -> None:
    check = {
        "check_id": "secrets",
        "status": "fail",
        "required": True,
        "measurement": {"count": 1, "locations": [".env:3"], "value": "sk-live-123"},
        "reason": "secret found",
    }
    with pytest.raises(ValidationError):
        QualityReport.model_validate({**quality_report_json, "gate": "fail", "checks": [check]})
