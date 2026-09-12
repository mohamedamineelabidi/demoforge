"""Motion style profile: generator defaults derived from the reference analysis.

Source of truth for values: ``references/style_analysis/style_profile.json`` (built from 13
frame-cited reference analyses). This schema validates that file and any per-project override.
Frames only, never seconds.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ShotDuration(_Strict):
    min: int = Field(ge=30)
    typical: int = Field(ge=30)
    max: int = Field(ge=30)

    @model_validator(mode="after")
    def _ordered(self) -> ShotDuration:
        if not self.min <= self.typical <= self.max:
            raise ValueError("shot_duration_frames must satisfy min <= typical <= max")
        return self


class Beat(_Strict):
    name: Literal["start_state", "action", "result"]
    frames: tuple[int, int]
    caption: str

    @model_validator(mode="after")
    def _range(self) -> Beat:
        start, end = self.frames
        if start < 0 or end <= start:
            raise ValueError(f"beat {self.name}: frames must be [start, end) with end > start")
        return self


class Transitions(_Strict):
    between_beats: str
    within_beat: str
    push_in_max_scale: float = Field(gt=1.0, le=1.5)
    banned: list[str]


class Framing(_Strict):
    footage_container: Literal["rounded_card", "full_bleed"]
    corner_radius_px: int = Field(ge=0, le=48)
    shadow: str
    field: str
    footage_scale_of_frame: float = Field(gt=0.5, le=1.0)


class Captions(_Strict):
    position: str
    style: Literal["sentence_case"]
    reveal: Literal["typewriter", "fade", "none"]
    reveal_frames_per_char: int = Field(ge=0, le=4)
    max_chars: int = Field(ge=20, le=90)
    font: str
    size_ratio_of_frame_height: float = Field(gt=0.02, lt=0.1)
    lint: list[str]


class Highlight(_Strict):
    primary: str
    secondary: str
    mask_style: str
    cursor: Literal["keep_native_cursor_visible", "hide"]

    @model_validator(mode="after")
    def _no_black_masks(self) -> Highlight:
        if "black" in self.mask_style and "never_black" not in self.mask_style:
            raise ValueError("black masks over the UI are banned (see SUMMARY.md do-not list)")
        return self


class Colour(_Strict):
    accents_per_shot: int = Field(ge=1, le=2)
    cyan_reserved_for: str
    field_families: list[str]


class Easing(_Strict):
    default: str
    durations_frames: dict[str, int]


class EndCard(_Strict):
    frames: int = Field(ge=60, le=180)
    content: list[str]


class Audio(_Strict):
    music: str
    voiceover: str


class StyleProfile(_Strict):
    schema_version: str
    derived_from: list[str]
    fps: Literal[30]
    target_duration_frames: int = Field(ge=300, le=1800)
    aspect: Literal["16:9", "1:1", "9:16"]
    shot_duration_frames: ShotDuration
    beats: list[Beat]
    transitions: Transitions
    framing: Framing
    captions: Captions
    highlight: Highlight
    colour: Colour
    easing: Easing
    end_card: EndCard
    audio: Audio

    @model_validator(mode="after")
    def _beats_cover_duration(self) -> StyleProfile:
        names = [b.name for b in self.beats]
        if names != ["start_state", "action", "result"]:
            raise ValueError("beats must be exactly start_state, action, result in that order")
        cursor = 0
        for beat in self.beats:
            if beat.frames[0] != cursor:
                raise ValueError(f"beat {beat.name} must start at frame {cursor}")
            cursor = beat.frames[1]
        if cursor != self.target_duration_frames:
            raise ValueError("beats must tile [0, target_duration_frames) exactly")
        return self
