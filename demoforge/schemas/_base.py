"""Shared primitives for every contract: strict base model, hash/time/path types."""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
)

SchemaVersion = Literal[1]

Sha1 = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{40}$")]
Sha256 = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
NonBlankStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
PositiveRevision = Annotated[int, Field(ge=1)]


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("timestamps must carry a timezone")
    return value.astimezone(UTC)


def _serialize_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


UtcDatetime = Annotated[
    datetime,
    AfterValidator(_to_utc),
    PlainSerializer(_serialize_utc, return_type=str, when_used="json"),
]


def validate_relative_path(value: str) -> str:
    """Run-relative, forward-slash path with no absolute root, drive, URL scheme or traversal."""
    if not value or value != value.strip():
        raise ValueError("path must be a non-empty relative path")
    if "\\" in value:
        raise ValueError("path must use forward slashes")
    if value.startswith("/") or value.startswith("~"):
        raise ValueError("path must be relative")
    if len(value) > 1 and value[1] == ":":
        raise ValueError("path must not contain a drive letter")
    if "://" in value:
        raise ValueError("path must not be a URL")
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("path must not contain empty, '.' or '..' segments")
    return value


RelativePath = Annotated[str, AfterValidator(validate_relative_path)]


def _finite_non_negative(value: float | None) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value) or value < 0:
        raise ValueError("cost values must be finite and non-negative")
    return value


CostValue = Annotated[float | None, AfterValidator(_finite_non_negative)]


class StrictModel(BaseModel):
    """Base for all contracts: unknown fields rejected, values validated on assignment."""

    model_config = ConfigDict(extra="forbid", validate_assignment=True, str_strip_whitespace=False)


class FrozenModel(StrictModel):
    """Immutable record (approvals, evidence)."""

    model_config = ConfigDict(extra="forbid", frozen=True)


def unique_ids(items: list[Any], attr: str, label: str) -> None:
    seen: set[str] = set()
    for item in items:
        key = getattr(item, attr)
        if key in seen:
            raise ValueError(f"duplicate {label}: {key}")
        seen.add(key)
