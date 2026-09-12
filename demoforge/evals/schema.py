"""Offline evaluation-fixture format: cases with expected gates and metrics.

Metrics use ``None`` for unknown values. Zero is only ever an explicit measurement.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, Field

from demoforge.schemas._base import NonBlankStr, StrictModel, UtcDatetime

EvalKind = Literal[
    "authorized_recording",
    "invalid_media",
    "missing_evidence",
    "prompt_injection",
    "privacy",
    "failure",
]
ExpectedGate = Literal["pass", "ask_user", "fail"]


def _finite_non_negative(value: float | None) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value) or value < 0:
        raise ValueError("metric values must be finite and non-negative")
    return value


Measure = Annotated[float | None, AfterValidator(_finite_non_negative)]
Count = Annotated[int | None, Field(ge=0)]
Flag = Annotated[bool | None, Field(strict=True)]


class Permission(StrictModel):
    """Attestation that the recording/repo may be used. Not a legal guarantee."""

    actor_id: NonBlankStr
    attested_at: UtcDatetime
    scope: NonBlankStr


class EvalCase(StrictModel):
    """One offline evaluation case with its inputs and expected outcome."""

    case_id: NonBlankStr
    kind: EvalKind
    description: NonBlankStr
    inputs: dict[str, Any]
    expected_claims: list[str]
    expected_gate: ExpectedGate
    permission: Permission | None = None


class EvalMetrics(StrictModel):
    """Measured outcome of a case run. ``None`` means unknown, never zero."""

    model_cost_usd: Measure = None
    compute_cost_usd: Measure = None
    storage_cost_usd: Measure = None
    retry_count: Count = None
    correction_time_s: Measure = None
    capture_success: Flag = None
    render_failure: Flag = None
    user_accepted: Flag = None


def load_cases(path: str | Path) -> list[EvalCase]:
    """Load and validate every ``*.json`` case under ``path``, sorted by file name."""
    directory = Path(path)
    if not directory.is_dir():
        raise FileNotFoundError(str(directory))
    cases: list[EvalCase] = []
    for file in sorted(directory.glob("*.json")):
        raw = json.loads(file.read_text(encoding="utf-8"))
        cases.append(EvalCase.model_validate(raw))
    return cases


__all__ = [
    "EvalCase",
    "EvalKind",
    "EvalMetrics",
    "ExpectedGate",
    "Permission",
    "load_cases",
]
