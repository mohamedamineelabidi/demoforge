"""Recorded demos retain explicit coverage and genuine source frame bounds."""

from copy import deepcopy

import pytest
from pydantic import ValidationError

from demoforge.schemas.recorded_demo import CoverageReport, RecordedDemoPlan, RecordedDemoSpec


def plan_data():
    return {
        "schema_version": 1,
        "plan_id": "demo",
        "revision": 1,
        "mode": "full_app",
        "features": [{"feature_id": "captions", "title": "Edit caption", "state_ids": ["canvas"]}],
        "states": [{"state_id": "canvas", "route": "/", "role": "editor"}],
        "frontier": ["protected-settings"],
        "scenarios": [
            {
                "scenario_id": "edit",
                "feature_id": "captions",
                "start_state_id": "canvas",
                "goal": "Save a caption",
                "preconditions": ["Owned test draft is open"],
                "steps": [{"action": "click", "target": "Save caption"}],
                "assertions": [{"assertion_id": "saved", "expected": "Caption is persisted"}],
            }
        ],
    }


def report_data(status="passed"):
    result = {"assertion_id": "saved", "status": status}
    if status in ("passed", "failed"):
        result["evidence_sha256"] = "a" * 64
    if status != "passed":
        result["reason"] = "Observed failure" if status == "failed" else "Not executed"
    return {
        "schema_version": 1,
        "attempt_id": "attempt-1",
        "plan": plan_data(),
        "results": [result],
    }


def spec_data():
    return {
        "schema_version": 1,
        "spec_id": "film",
        "revision": 1,
        "coverage": report_data(),
        "fps": 30,
        "total_frames": 2700,
        "clips": [
            {
                "clip_id": "raw",
                "path": "staging/clip.mp4",
                "sha256": "a" * 64,
                "frame_count": 3000,
                "fps": 30,
            }
        ],
        "shots": [
            {
                "shot_id": "result",
                "clip_id": "raw",
                "assertion_id": "saved",
                "start_frame": 0,
                "end_frame": 2700,
                "source_in_frame": 30,
                "caption": "Save the caption",
                "zoom": 1.2,
                "zoom_ramp_frames": 12,
            }
        ],
    }


def test_plan_roundtrip_and_pending_frontier():
    plan = RecordedDemoPlan.model_validate(plan_data())
    assert RecordedDemoPlan.model_validate_json(plan.model_dump_json()) == plan
    assert plan.frontier == ("protected-settings",)
    with pytest.raises(ValidationError):
        plan.revision = 2


@pytest.mark.parametrize(
    "mutation",
    [
        lambda data: data["features"].append(deepcopy(data["features"][0])),
        lambda data: data["features"][0].update(state_ids=["missing"]),
        lambda data: data["scenarios"][0].update(feature_id="missing"),
        lambda data: data["scenarios"][0].update(start_state_id="missing"),
        lambda data: data.update(scenarios=[]),
        lambda data: data["scenarios"][0]["steps"][0].update(action="evaluate", script="alert(1)"),
        lambda data: data["scenarios"][0]["assertions"].append(
            deepcopy(data["scenarios"][0]["assertions"][0])
        ),
    ],
)
def test_invalid_plan_rejected(mutation):
    data = plan_data()
    mutation(data)
    with pytest.raises(ValidationError):
        RecordedDemoPlan.model_validate(data)


@pytest.mark.parametrize("status", ["passed", "failed", "blocked", "not_run"])
def test_coverage_counts_assertions_not_visits(status):
    report = CoverageReport.model_validate(report_data(status))
    assert report.summary == {
        "required": 1,
        "passed": int(status == "passed"),
        "failed": int(status == "failed"),
        "blocked": int(status == "blocked"),
        "not_run": int(status == "not_run"),
    }
    assert report.selected_scope_passed is (status == "passed")


@pytest.mark.parametrize(
    "mutation",
    [
        lambda data: data.update(results=[]),
        lambda data: data["results"].append(deepcopy(data["results"][0])),
        lambda data: data["results"][0].update(assertion_id="unknown"),
        lambda data: data["results"][0].pop("evidence_sha256"),
        lambda data: data["results"][0].update(status="blocked", evidence_sha256=None),
    ],
)
def test_coverage_cannot_hide_missing_or_failed_checks(mutation):
    data = report_data()
    mutation(data)
    with pytest.raises(ValidationError):
        CoverageReport.model_validate(data)


def test_recorded_spec_supports_longer_chapters_without_changing_legacy_contract():
    spec = RecordedDemoSpec.model_validate(spec_data())
    assert spec.total_frames == 2700
    assert spec.shots[0].zoom_ramp_frames == 12
    assert RecordedDemoSpec.model_validate_json(spec.model_dump_json()) == spec


@pytest.mark.parametrize(
    "mutation",
    [
        lambda data: data["shots"][0].update(start_frame=1),
        lambda data: data["shots"][0].update(end_frame=2699),
        lambda data: data["shots"][0].update(clip_id="missing"),
        lambda data: data["shots"][0].update(assertion_id="unknown"),
        lambda data: data["shots"][0].update(source_in_frame=500),
        lambda data: data["shots"][0].update(zoom=float("nan")),
        lambda data: data["shots"][0].update(zoom_ramp_frames=2000),
        lambda data: data["clips"][0].update(path="../private.mp4"),
        lambda data: data["clips"][0].update(sha256="c" * 64),
        lambda data: data.update(coverage=report_data("failed")),
        lambda data: data.update(human_approved=True),
    ],
)
def test_invalid_recorded_spec_rejected(mutation):
    data = spec_data()
    mutation(data)
    with pytest.raises(ValidationError):
        RecordedDemoSpec.model_validate(data)


def test_source_frame_bounds_use_native_frame_rate():
    data = spec_data()
    data["clips"][0].update(fps=25, frame_count=2250)
    data["shots"][0]["source_in_frame"] = 0
    RecordedDemoSpec.model_validate(data)
    data["shots"][0]["source_in_frame"] = 1
    with pytest.raises(ValidationError, match="source bounds"):
        RecordedDemoSpec.model_validate(data)


def test_partial_coverage_remains_visible_in_highlight_spec():
    data = spec_data()
    data["coverage"]["plan"]["scenarios"][0]["assertions"].append(
        {"assertion_id": "reload", "expected": "Caption survives reload"}
    )
    data["coverage"]["results"].append(
        {"assertion_id": "reload", "status": "not_run", "reason": "Not executed"}
    )
    spec = RecordedDemoSpec.model_validate(data)
    assert spec.coverage.summary["not_run"] == 1
    assert not spec.coverage.selected_scope_passed


def test_nested_records_cannot_be_mutated_in_place():
    plan = RecordedDemoPlan.model_validate(plan_data())
    assert isinstance(plan.scenarios, tuple)
    assert isinstance(plan.scenarios[0].steps, tuple)
    with pytest.raises(ValidationError):
        plan.scenarios[0].steps[0].target = "Delete project"
