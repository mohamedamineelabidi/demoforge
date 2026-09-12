"""The reference-derived style profile must validate and stay frame-based."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from demoforge.schemas.style_profile import StyleProfile

PROFILE = (
    Path(__file__).resolve().parents[2] / "references" / "style_analysis" / "style_profile.json"
)


def _load() -> dict:
    return json.loads(PROFILE.read_text(encoding="utf-8"))


def test_reference_profile_validates() -> None:
    profile = StyleProfile.model_validate(_load())
    assert profile.fps == 30
    assert profile.target_duration_frames == 900
    assert [b.name for b in profile.beats] == ["start_state", "action", "result"]
    assert len(profile.derived_from) >= 13


def test_beats_must_tile_the_duration() -> None:
    data = _load()
    data["beats"][1]["frames"] = [180, 600]
    with pytest.raises(ValidationError, match="must start at frame 600"):
        StyleProfile.model_validate(data)


def test_black_mask_is_rejected() -> None:
    data = _load()
    data["highlight"]["mask_style"] = "black_overlay"
    with pytest.raises(ValidationError, match="black masks"):
        StyleProfile.model_validate(data)


def test_shot_duration_order() -> None:
    data = _load()
    data["shot_duration_frames"] = {"min": 200, "typical": 150, "max": 300}
    with pytest.raises(ValidationError, match="min <= typical <= max"):
        StyleProfile.model_validate(data)


def test_unknown_keys_rejected() -> None:
    data = _load()
    data["seconds"] = 30
    with pytest.raises(ValidationError):
        StyleProfile.model_validate(data)
