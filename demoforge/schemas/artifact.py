"""Artifact references and the per-attempt manifest that publishes them."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from demoforge.schemas._base import (
    CostValue,
    NonBlankStr,
    PositiveRevision,
    RelativePath,
    SchemaVersion,
    Sha256,
    StrictModel,
    UtcDatetime,
    unique_ids,
)

GateOutcome = Literal["pass", "ask_user", "fail"]


class ArtifactRef(StrictModel):
    artifact_id: NonBlankStr
    path: RelativePath
    sha256: Sha256
    media_type: NonBlankStr
    size_bytes: int = Field(ge=0)


class Cost(StrictModel):
    """Unknown measurements are null, never zero."""

    currency: NonBlankStr
    model: CostValue
    compute: CostValue
    storage: CostValue
    total: CostValue


class ArtifactManifest(StrictModel):
    schema_version: SchemaVersion
    manifest_id: NonBlankStr
    run_id: NonBlankStr
    stage_id: NonBlankStr
    attempt_id: NonBlankStr
    revision: PositiveRevision
    created_at: UtcDatetime
    input_manifest_ids: list[NonBlankStr] = Field(default_factory=list)
    input_hashes: list[Sha256] = Field(default_factory=list)
    options_hash: Sha256
    tool_versions: dict[str, str] = Field(default_factory=dict)
    schema_versions: dict[str, int] = Field(default_factory=dict)
    template_version: str | None
    model_id: str | None
    prompt_hash: Sha256 | None
    outputs: list[ArtifactRef] = Field(default_factory=list)
    gate: GateOutcome
    cost: Cost

    @model_validator(mode="after")
    def _outputs_consistent_with_gate(self) -> ArtifactManifest:
        unique_ids(self.outputs, "artifact_id", "artifact_id")
        unique_ids(self.outputs, "path", "artifact path")
        if self.gate == "pass" and not self.outputs:
            raise ValueError("a passing manifest must publish at least one output")
        if self.gate == "fail" and self.outputs:
            raise ValueError("a failed attempt must not carry successful-output pointers")
        return self
