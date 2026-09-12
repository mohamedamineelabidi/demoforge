"""Stage interface: what a pipeline step receives, returns and may raise.

Stages are plain objects. They never write to the state database; the controller owns commits.
A stage publishes files through ``ctx.workspace`` and returns hashed references. Anything else
(approval, retry, invalidation) is the controller's decision.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from demoforge.pack.workspace import RunWorkspace
from demoforge.schemas import ArtifactRef


class TransientError(RuntimeError):
    """Network, timeout or tool hiccup. Safe to retry with identical inputs."""


class ContentError(RuntimeError):
    """The produced content failed a gate (dangling claim, banned phrase...). One bounded repair."""


@dataclass(frozen=True)
class StageRequest:
    schema_version: int
    run_id: str
    stage_id: str
    attempt_id: str
    input_manifest_ids: list[str]
    options: dict[str, Any]
    idempotency_key: str
    repair_hint: str | None = None


@dataclass(frozen=True)
class StageContext:
    """Dependency container, never serialized."""

    workspace: RunWorkspace
    now: Callable[[], datetime]
    cancelled: Callable[[], bool]


# (subject_type, subject_id, subject_revision, subject_sha256)
ApprovalSubject = tuple[str, str, int, str]


@dataclass(frozen=True)
class StageOutcome:
    outputs: list[ArtifactRef]
    approval_subject: ApprovalSubject | None = None
    tool_versions: dict[str, str] = field(default_factory=dict)
    model_id: str | None = None
    prompt_hash: str | None = None
    warnings: list[str] = field(default_factory=list)


class Stage(Protocol):
    stage_id: str
    run_state: str

    def run(self, request: StageRequest, ctx: StageContext) -> StageOutcome: ...
