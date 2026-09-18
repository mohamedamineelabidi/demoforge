"""Data contracts for generalized end-to-end automated demo pipeline."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ElementBoundingBox(BaseModel):
    """Bounding box of an interactive DOM landmark."""

    x: float
    y: float
    width: float
    height: float


class InteractionStep(BaseModel):
    """Individual humanized browser interaction step."""

    action_type: Literal["click", "type", "hover", "scroll", "wait"]
    target_selector: str
    input_value: str | None = None
    scroll_delta_y: int | None = None
    target_bounds: ElementBoundingBox | None = None
    duration_ms: int = 1000


class WordTimestamp(BaseModel):
    """Phonetic word-level timestamp for kinetic typography and subtitling."""

    word: str
    start_sec: float
    end_sec: float


class SceneSpec(BaseModel):
    """Single timed scene containing voiceover copy, focus, and interactions."""

    scene_id: str
    title: str
    voiceover_script: str
    interactions: list[InteractionStep] = Field(default_factory=list)
    camera_focus: ElementBoundingBox | None = None
    camera_zoom: float = 1.2
    badge_label: str | None = None
    word_timestamps: list[WordTimestamp] = Field(default_factory=list)
    duration_frames: int = 210


class DemoScriptSpec(BaseModel):
    """Complete multi-scene storyboard and media blueprint."""

    project_id: str
    target_url: str
    title: str
    tagline: str
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    fps: int = 30
    theme_accent_color: str = "#6366F1"
    background_music_preset: str = "corporate_ambient"
    scenes: list[SceneSpec]


class JobSubmissionRequest(BaseModel):
    """Request payload to initiate automated demo video generation."""

    target_url: str
    goal: str | None = "Product Feature Walkthrough"
    aspect_ratio: Literal["16:9", "9:16"] = "16:9"
    auth_cookies: dict[str, str] | None = None
    custom_headers: dict[str, str] | None = None
    voice_id: str = "natural_en_male_1"

