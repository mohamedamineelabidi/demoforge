"""Approvals: immutable human decisions bound to an exact subject revision and content hash."""

from __future__ import annotations

from typing import Literal

from demoforge.schemas._base import (
    FrozenModel,
    NonBlankStr,
    PositiveRevision,
    SchemaVersion,
    Sha256,
    UtcDatetime,
)

SubjectType = Literal["claims", "scenario", "storyboard", "output"]
Decision = Literal["approved", "rejected"]


class Approval(FrozenModel):
    schema_version: SchemaVersion
    approval_id: NonBlankStr
    run_id: NonBlankStr
    subject_type: SubjectType
    subject_id: NonBlankStr
    subject_revision: PositiveRevision
    subject_sha256: Sha256
    actor_id: NonBlankStr
    decision: Decision
    decided_at: UtcDatetime
    note: str | None


def approval_matches(
    approval: Approval,
    subject_type: SubjectType,
    subject_id: str,
    subject_revision: int,
    subject_sha256: str,
) -> bool:
    """True only for an *approved* decision on exactly this subject, revision and content hash.

    Any change to the subject produces a new revision/hash and therefore a stale approval.
    """
    return (
        approval.decision == "approved"
        and approval.subject_type == subject_type
        and approval.subject_id == subject_id
        and approval.subject_revision == subject_revision
        and approval.subject_sha256 == subject_sha256
    )
