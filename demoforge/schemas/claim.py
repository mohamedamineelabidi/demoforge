"""Claims and the evidence catalog that binds them to a pinned repository snapshot.

Schema validity never equals verified truth. ``validate_claim_support`` performs the pure
cross-reference check (dangling IDs, status requirements); I/O-backed checks live elsewhere.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Literal

from pydantic import Field, model_validator

from demoforge.schemas._base import (
    NonBlankStr,
    PositiveRevision,
    RelativePath,
    SchemaVersion,
    Sha1,
    Sha256,
    StrictModel,
    UtcDatetime,
    unique_ids,
)
from demoforge.schemas.evidence import Evidence

VerificationStatus = Literal[
    "documented", "statically_supported", "runtime_observed", "user_attested"
]

FileClassification = Literal[
    "readme",
    "docs",
    "manifest",
    "source_code",
    "test",
    "config",
    "image",
    "media",
    "license",
    "lockfile",
    "binary",
    "other",
]
ScanStatus = Literal["clean", "redacted", "excluded", "not_scanned"]


class Claim(StrictModel):
    schema_version: SchemaVersion
    claim_id: NonBlankStr
    revision: PositiveRevision
    text: NonBlankStr
    evidence_ids: list[NonBlankStr] = Field(min_length=1)
    verification_status: VerificationStatus
    limitations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_evidence(self) -> Claim:
        if len(set(self.evidence_ids)) != len(self.evidence_ids):
            raise ValueError("evidence_ids must be unique")
        return self


def validate_claim_support(claim: Claim, evidence_index: Mapping[str, Evidence]) -> list[str]:
    """Return human-readable errors; empty means references resolve and satisfy the status."""
    errors: list[str] = []
    resolved: list[Evidence] = []
    for evidence_id in claim.evidence_ids:
        evidence = evidence_index.get(evidence_id)
        if evidence is None:
            errors.append(f"claim {claim.claim_id}: dangling evidence id {evidence_id}")
        else:
            resolved.append(evidence)
    kinds = {e.kind for e in resolved}
    if claim.verification_status == "runtime_observed" and "observation" not in kinds:
        errors.append(
            f"claim {claim.claim_id}: runtime_observed requires observation evidence, "
            "documentation alone is not runtime proof"
        )
    if claim.verification_status == "user_attested" and "attestation" not in kinds:
        errors.append(f"claim {claim.claim_id}: user_attested requires attestation evidence")
    return errors


class Repository(StrictModel):
    repo_url: NonBlankStr
    full_name: NonBlankStr
    commit_sha: Sha1
    acquired_at: UtcDatetime
    license: str | None
    metadata_evidence_ids: list[NonBlankStr] = Field(default_factory=list)


class FileRecord(StrictModel):
    path: RelativePath
    classification: FileClassification
    size_bytes: int = Field(ge=0)
    content_sha256: Sha256
    scan_status: ScanStatus
    exclusion_reason: str | None


class EvidenceCatalog(StrictModel):
    schema_version: SchemaVersion
    catalog_id: NonBlankStr
    revision: PositiveRevision
    repository: Repository
    evidence: list[Evidence] = Field(default_factory=list)
    claims: list[Claim] = Field(default_factory=list)
    assets: list[NonBlankStr] = Field(default_factory=list)
    files: list[FileRecord] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique(self) -> EvidenceCatalog:
        unique_ids(self.evidence, "evidence_id", "evidence_id")
        unique_ids(self.claims, "claim_id", "claim_id")
        unique_ids(self.files, "path", "file path")
        return self

    def evidence_index(self) -> dict[str, Evidence]:
        return {e.evidence_id: e for e in self.evidence}

    def support_errors(self) -> list[str]:
        index = self.evidence_index()
        errors: list[str] = []
        for claim in self.claims:
            errors.extend(validate_claim_support(claim, index))
        return errors
