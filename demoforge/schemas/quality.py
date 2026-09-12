"""Quality reports: per-check results; the gate can never override a failed required check."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field, model_validator

from demoforge.schemas._base import (
    NonBlankStr,
    PositiveRevision,
    SchemaVersion,
    StrictModel,
    unique_ids,
)
from demoforge.schemas.artifact import GateOutcome

CheckStatus = Literal["pass", "fail", "not_run"]

# Measurement keys that would carry a secret value rather than a count or location.
_FORBIDDEN_MEASUREMENT_KEYS = frozenset(
    {"value", "values", "secret", "secrets", "token", "password", "key"}
)


class Check(StrictModel):
    check_id: NonBlankStr
    status: CheckStatus
    required: bool
    measurement: dict[str, Any] | None
    reason: str | None

    @model_validator(mode="after")
    def _no_secret_values(self) -> Check:
        if self.measurement:
            leaked = _FORBIDDEN_MEASUREMENT_KEYS.intersection(k.lower() for k in self.measurement)
            if leaked:
                raise ValueError(
                    "measurement must hold counts/locations only, not values "
                    f"(keys: {sorted(leaked)})"
                )
        return self


class QualityReport(StrictModel):
    schema_version: SchemaVersion
    report_id: NonBlankStr
    subject_id: NonBlankStr
    subject_revision: PositiveRevision
    gate: GateOutcome
    checks: list[Check] = Field(default_factory=list)
    missing_inputs: list[str] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _gate_consistent(self) -> QualityReport:
        unique_ids(self.checks, "check_id", "check_id")
        required_blocked = [c for c in self.checks if c.required and c.status != "pass"]
        if self.gate == "pass" and required_blocked:
            ids = ", ".join(f"{c.check_id}={c.status}" for c in required_blocked)
            raise ValueError(f"gate cannot be 'pass' with required checks not passing: {ids}")
        if self.gate == "ask_user" and not (self.questions or self.missing_inputs):
            raise ValueError("gate 'ask_user' requires at least one question or missing input")
        return self

    def blocks_completion(self) -> bool:
        return self.gate != "pass"
