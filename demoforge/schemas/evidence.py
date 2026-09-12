"""Evidence: one sanitized quotation from a source, pinned to a revision or observation."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from demoforge.schemas._base import (
    FrozenModel,
    NonBlankStr,
    SchemaVersion,
    Sha1,
    Sha256,
    UtcDatetime,
)

EvidenceKind = Literal["repository", "website", "api", "observation", "attestation"]


class Evidence(FrozenModel):
    schema_version: SchemaVersion
    evidence_id: NonBlankStr
    kind: EvidenceKind
    source: NonBlankStr
    revision: Sha1 | None
    line_start: int | None = Field(ge=1)
    line_end: int | None = Field(ge=1)
    quote: str
    acquired_at: UtcDatetime
    content_sha256: Sha256
    observation_id: NonBlankStr | None
    attestation_id: NonBlankStr | None

    @model_validator(mode="after")
    def _check_kind_requirements(self) -> Evidence:
        if self.kind == "repository":
            if self.revision is None:
                raise ValueError("repository evidence requires a full commit revision")
            if self.line_start is None or self.line_end is None:
                raise ValueError("repository evidence requires a line range")
        if (
            self.line_start is not None
            and self.line_end is not None
            and self.line_end < self.line_start
        ):
            raise ValueError("line_end must be >= line_start")
        if (self.line_start is None) != (self.line_end is None):
            raise ValueError("line_start and line_end must both be set or both be null")
        if self.kind == "observation" and self.observation_id is None:
            raise ValueError("observation evidence requires observation_id")
        if self.kind == "attestation" and self.attestation_id is None:
            raise ValueError("attestation evidence requires attestation_id")
        return self
