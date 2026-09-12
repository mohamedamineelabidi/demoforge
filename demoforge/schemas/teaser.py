"""Version-one, typography-only teaser contract with half-open frame ranges."""

import re
import unicodedata
from typing import Literal

from pydantic import Field, field_validator, model_validator

from demoforge.quality.banned_phrases import lint_copy
from demoforge.quality.secrets import sanitize_text
from demoforge.schemas._base import Sha1, Sha256, StrictModel


def validate_teaser_text(value: str) -> str:
    """Require plain, unmodified display copy; never repair source excerpts."""
    if (
        not value.strip()
        or value != value.strip()
        or any(unicodedata.category(char).startswith("C") for char in value)
        or any(char in value for char in "<>[]`*_{}\\|")
        or "[redacted]" in value.casefold()
        or sanitize_text(value).redacted
        or lint_copy(value)
    ):
        raise ValueError("teaser text must be clean plain text and pass copy lint")
    return value


class TeaserScene(StrictModel):
    scene_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    kind: Literal["title", "feature", "end"]
    start_frame: int = Field(ge=0, lt=900, strict=True)
    end_frame: int = Field(gt=0, le=900, strict=True)
    text: str = Field(min_length=1, max_length=60)
    evidence_id: str = Field(min_length=1, max_length=256)

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return validate_teaser_text(value)

    @field_validator("evidence_id")
    @classmethod
    def clean_evidence_id(cls, value: str) -> str:
        if value != value.strip() or not value or any(char.isspace() for char in value):
            raise ValueError("evidence_id must be nonblank without whitespace")
        if any(unicodedata.category(char).startswith("C") for char in value):
            raise ValueError("evidence_id must not contain control characters")
        return value

    @model_validator(mode="after")
    def positive_duration(self) -> "TeaserScene":
        if self.end_frame <= self.start_frame:
            raise ValueError("scene must have positive duration")
        return self


class TeaserSpec(StrictModel):
    schema_version: Literal[1] = 1
    revision: int = Field(default=1, ge=1, strict=True)
    product_name: str = Field(min_length=1, max_length=60)
    repository_url: str = Field(min_length=1, max_length=300)
    commit_sha: Sha1
    catalog_sha256: Sha256
    fps: Literal[30] = 30
    width: Literal[1920] = 1920
    height: Literal[1080] = 1080
    total_frames: Literal[900] = 900
    scenes: list[TeaserScene] = Field(min_length=3, max_length=3)

    @field_validator("product_name")
    @classmethod
    def safe_product_name(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value):
            raise ValueError("product_name must be a safe repository name")
        if sanitize_text(value).redacted or lint_copy(value):
            raise ValueError("product_name fails copy safety checks")
        return value

    @model_validator(mode="after")
    def exact_timeline(self) -> "TeaserSpec":
        expected = [("title", 0, 180), ("feature", 180, 660), ("end", 660, 900)]
        actual = [(scene.kind, scene.start_frame, scene.end_frame) for scene in self.scenes]
        if actual != expected:
            raise ValueError(
                "teaser requires contiguous title/feature/end ranges through frame 900"
            )
        if len({scene.scene_id for scene in self.scenes}) != 3:
            raise ValueError("scene IDs must be unique")
        return self