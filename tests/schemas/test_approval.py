from __future__ import annotations

import pytest
from pydantic import ValidationError

from demoforge.schemas import Approval, approval_matches
from tests.schemas.conftest import SHA256


def test_round_trip(approval_json: dict) -> None:
    assert Approval.model_validate(approval_json).model_dump(mode="json") == approval_json


def test_rejects_invalid_subject_type_and_decision(approval_json: dict) -> None:
    with pytest.raises(ValidationError):
        Approval.model_validate({**approval_json, "subject_type": "deck"})
    with pytest.raises(ValidationError):
        Approval.model_validate({**approval_json, "decision": "maybe"})


def test_rejects_blank_actor(approval_json: dict) -> None:
    with pytest.raises(ValidationError):
        Approval.model_validate({**approval_json, "actor_id": ""})


def test_is_frozen(approval_json: dict) -> None:
    model = Approval.model_validate(approval_json)
    with pytest.raises(ValidationError):
        model.decision = "rejected"  # type: ignore[misc]


def test_matches_exact_revision_and_hash(approval_json: dict) -> None:
    approval = Approval.model_validate(approval_json)
    assert approval_matches(approval, "storyboard", "sb_001", 3, SHA256)


def test_stale_when_revision_changes(approval_json: dict) -> None:
    approval = Approval.model_validate(approval_json)
    assert not approval_matches(approval, "storyboard", "sb_001", 4, SHA256)


def test_stale_when_content_hash_changes(approval_json: dict) -> None:
    approval = Approval.model_validate(approval_json)
    assert not approval_matches(approval, "storyboard", "sb_001", 3, "c" * 64)


def test_rejected_decision_never_matches(approval_json: dict) -> None:
    approval = Approval.model_validate({**approval_json, "decision": "rejected"})
    assert not approval_matches(approval, "storyboard", "sb_001", 3, SHA256)


def test_wrong_subject_never_matches(approval_json: dict) -> None:
    approval = Approval.model_validate(approval_json)
    assert not approval_matches(approval, "output", "sb_001", 3, SHA256)
    assert not approval_matches(approval, "storyboard", "sb_002", 3, SHA256)
