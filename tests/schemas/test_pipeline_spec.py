"""Unit tests for pipeline data contracts."""

import pytest
from pydantic import ValidationError

from demoforge.schemas.pipeline_spec import (
    DemoScriptSpec,
    ElementBoundingBox,
    InteractionStep,
    JobSubmissionRequest,
    SceneSpec,
    WordTimestamp,
)


def test_element_bounding_box_valid():
    box = ElementBoundingBox(x=10.0, y=20.0, width=100.0, height=50.0)
    assert box.x == 10.0
    assert box.y == 20.0
    assert box.width == 100.0
    assert box.height == 50.0


def test_interaction_step_types():
    step = InteractionStep(
        action_type="click",
        target_selector="button#submit",
        duration_ms=800,
    )
    assert step.action_type == "click"
    assert step.target_selector == "button#submit"

    with pytest.raises(ValidationError):
        InteractionStep(action_type="invalid_action", target_selector="div")


def test_demo_script_spec_assembly():
    spec = DemoScriptSpec(
        project_id="job-123",
        target_url="http://localhost:3000",
        title="App Showcase",
        tagline="Automated walkthrough",
        aspect_ratio="16:9",
        scenes=[
            SceneSpec(
                scene_id="scene-1",
                title="Hero Section",
                voiceover_script="Welcome to the workflow engine.",
                word_timestamps=[
                    WordTimestamp(word="Welcome", start_sec=0.1, end_sec=0.5),
                ],
                duration_frames=180,
            )
        ],
    )
    assert spec.project_id == "job-123"
    assert len(spec.scenes) == 1
    assert spec.scenes[0].word_timestamps[0].word == "Welcome"


def test_job_submission_request_defaults():
    req = JobSubmissionRequest(target_url="https://demo.app")
    assert req.target_url == "https://demo.app"
    assert req.aspect_ratio == "16:9"
    assert req.voice_id == "natural_en_male_1"

