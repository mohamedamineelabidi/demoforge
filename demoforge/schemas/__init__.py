"""Typed contracts (Pydantic v2). See docs/DATA_CONTRACTS.md for the human-readable version."""

from demoforge.schemas._base import RelativePath, Sha1, Sha256, StrictModel, UtcDatetime
from demoforge.schemas.approval import Approval, Decision, SubjectType, approval_matches
from demoforge.schemas.artifact import ArtifactManifest, ArtifactRef, Cost, GateOutcome
from demoforge.schemas.claim import (
    Claim,
    EvidenceCatalog,
    FileRecord,
    Repository,
    VerificationStatus,
    validate_claim_support,
)
from demoforge.schemas.evidence import Evidence, EvidenceKind
from demoforge.schemas.quality import Check, CheckStatus, QualityReport

__all__ = [
    "Approval",
    "ArtifactManifest",
    "ArtifactRef",
    "Check",
    "CheckStatus",
    "Claim",
    "Cost",
    "Decision",
    "Evidence",
    "EvidenceCatalog",
    "EvidenceKind",
    "FileRecord",
    "GateOutcome",
    "QualityReport",
    "RelativePath",
    "Repository",
    "Sha1",
    "Sha256",
    "StrictModel",
    "SubjectType",
    "UtcDatetime",
    "VerificationStatus",
    "approval_matches",
    "validate_claim_support",
]
