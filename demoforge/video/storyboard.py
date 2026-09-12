"""Conservative source-excerpt proposals and frame-contiguous pilot storyboards."""

import hashlib
from typing import Literal

from pydantic import Field, field_validator, model_validator

from demoforge.brand.tokens import BrandTokens
from demoforge.quality.banned_phrases import lint_copy
from demoforge.schemas._base import NonBlankStr, PositiveRevision, Sha256, StrictModel
from demoforge.schemas.approval import Approval, approval_matches
from demoforge.schemas.claim import EvidenceCatalog


class Caption(StrictModel):
    claim_id: NonBlankStr
    text: str = Field(min_length=1, max_length=60)
    evidence_id: NonBlankStr
    status: Literal["documented", "runtime_observed", "user_attested"]

    @field_validator("text")
    @classmethod
    def clean_caption(cls, value: str) -> str:
        if not value.strip() or any(ord(char) < 32 for char in value) or lint_copy(value):
            raise ValueError("caption fails copy rules")
        return value


class Proposal(StrictModel):
    schema_version: Literal[1] = 1
    proposal_id: NonBlankStr
    revision: PositiveRevision
    catalog_sha256: Sha256
    captions: list[Caption] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def distinct_claims(self):
        if len({caption.claim_id for caption in self.captions}) != 3:
            raise ValueError("claim IDs must be unique")
        return self


def validate_grounding(proposal: Proposal, catalog: EvidenceCatalog) -> None:
    index = catalog.evidence_index()
    for caption in proposal.captions:
        source = index.get(caption.evidence_id)
        if source is None or caption.text not in source.quote or "[REDACTED]" in caption.text:
            raise ValueError("caption is not an exact supported source excerpt")
        required_kind = {
            "documented": "repository",
            "runtime_observed": "observation",
            "user_attested": "attestation",
        }[caption.status]
        if source.kind != required_kind:
            raise ValueError("caption status does not match source evidence")
        if source.kind == "repository" and source.revision != catalog.repository.commit_sha:
            raise ValueError("caption source revision mismatch")


class Scene(StrictModel):
    start_frame: int = Field(ge=0, strict=True)
    end_frame: int = Field(gt=0, strict=True)
    source_in: int = Field(ge=0, strict=True)
    caption: Caption
    zoom: float = Field(default=1.08, ge=1, le=1.12, allow_inf_nan=False)


class Scenario(StrictModel):
    schema_version: Literal[1] = 1
    scenario_id: NonBlankStr
    revision: PositiveRevision
    proposal_sha256: Sha256
    media_sha256: Sha256
    source_in: list[int] = Field(min_length=3, max_length=3)

    @field_validator("source_in")
    @classmethod
    def valid_source_positions(cls, value: list[int]) -> list[int]:
        if any(position < 0 for position in value) or value != sorted(value):
            raise ValueError("scenario source positions must be nonnegative and chronological")
        return value


class Storyboard(StrictModel):
    schema_version: Literal[1] = 1
    storyboard_id: NonBlankStr
    revision: PositiveRevision
    proposal_sha256: Sha256
    media_sha256: Sha256
    media_frames: int = Field(gt=0, strict=True)
    fps: Literal[30] = 30
    brand: BrandTokens = Field(default_factory=BrandTokens)
    scenes: list[Scene] = Field(min_length=3, max_length=3)

    @model_validator(mode="after")
    def contiguous(self):
        position = 0
        for scene in self.scenes:
            duration = scene.end_frame - scene.start_frame
            if scene.start_frame != position or duration <= 0:
                raise ValueError("scenes must be positive and contiguous from frame zero")
            if scene.source_in + duration > self.media_frames:
                raise ValueError("scene exceeds normalized source frames")
            position = scene.end_frame
        if position != 900:
            raise ValueError("pilot requires exactly 900 frames")
        return self


def artifact_hash(model: StrictModel) -> str:
    return hashlib.sha256(model.model_dump_json().encode()).hexdigest()


def validate_render_inputs(
    run_id: str,
    catalog: EvidenceCatalog,
    proposal: Proposal,
    scenario: Scenario,
    storyboard: Storyboard,
    approvals: list[Approval],
) -> None:
    validate_grounding(proposal, catalog)
    if proposal.catalog_sha256 != artifact_hash(catalog):
        raise ValueError("catalog hash mismatch")
    proposal_hash = artifact_hash(proposal)
    if scenario.proposal_sha256 != proposal_hash or storyboard.proposal_sha256 != proposal_hash:
        raise ValueError("proposal hash mismatch")
    if scenario.media_sha256 != storyboard.media_sha256:
        raise ValueError("scenario media hash mismatch")
    if [scene.source_in for scene in storyboard.scenes] != scenario.source_in:
        raise ValueError("scenario trims mismatch")
    if [scene.caption for scene in storyboard.scenes] != proposal.captions:
        raise ValueError("storyboard captions differ from approved proposal")
    for kind, identity, subject in [
        ("claims", proposal.proposal_id, proposal),
        ("scenario", scenario.scenario_id, scenario),
        ("storyboard", storyboard.storyboard_id, storyboard),
    ]:
        matching = [
            approval
            for approval in approvals
            if approval.run_id == run_id
            and approval.subject_type == kind
            and approval.subject_id == identity
            and approval.subject_revision == subject.revision
            and approval.subject_sha256 == artifact_hash(subject)
        ]
        if any(approval.decision == "rejected" for approval in matching) or not any(
            approval_matches(approval, kind, identity, subject.revision, artifact_hash(subject))
            for approval in matching
        ):
            raise ValueError(f"current {kind} approval required")
