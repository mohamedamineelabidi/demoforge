"""Declarative recorded-demo contracts, not capture permission or execution authority."""

from __future__ import annotations

from fractions import Fraction
from typing import Annotated, Literal

from pydantic import Field, model_validator

from demoforge.schemas._base import (
    FrozenModel,
    NonBlankStr,
    PositiveRevision,
    RelativePath,
    SchemaVersion,
    Sha256,
)

Identifier = Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$")]
Frame = Annotated[int, Field(strict=True, ge=0)]
FrameRate = Annotated[int, Field(strict=True, ge=1, le=120)]
Text = Annotated[str, Field(min_length=1, max_length=1000, pattern=r"^[^<>\x00-\x1f]+$")]


def _unique(values: tuple[str, ...], label: str) -> set[str]:
    if len(set(values)) != len(values):
        raise ValueError(f"duplicate {label}")
    return set(values)


class AppState(FrozenModel):
    state_id: Identifier
    route: NonBlankStr
    role: Text


class AppFeature(FrozenModel):
    feature_id: Identifier
    title: Text
    state_ids: tuple[Identifier, ...] = Field(min_length=1, max_length=100)


class ScenarioStep(FrozenModel):
    action: Literal["click", "observe"]
    target: Text


class ScenarioAssertion(FrozenModel):
    assertion_id: Identifier
    expected: Text


class RecordedScenario(FrozenModel):
    scenario_id: Identifier
    feature_id: Identifier
    start_state_id: Identifier
    goal: Text
    preconditions: tuple[Text, ...] = Field(min_length=1, max_length=20)
    steps: tuple[ScenarioStep, ...] = Field(min_length=1, max_length=100)
    assertions: tuple[ScenarioAssertion, ...] = Field(min_length=1, max_length=100)


class RecordedDemoPlan(FrozenModel):
    schema_version: SchemaVersion
    plan_id: Identifier
    revision: PositiveRevision
    mode: Literal["full_app", "new_feature"]
    states: tuple[AppState, ...] = Field(min_length=1, max_length=100)
    features: tuple[AppFeature, ...] = Field(min_length=1, max_length=100)
    scenarios: tuple[RecordedScenario, ...] = Field(min_length=1, max_length=100)
    frontier: tuple[Text, ...] = Field(default=(), max_length=100)

    @property
    def assertion_ids(self) -> tuple[str, ...]:
        return tuple(
            assertion.assertion_id
            for scenario in self.scenarios
            for assertion in scenario.assertions
        )

    @model_validator(mode="after")
    def validate_links(self) -> RecordedDemoPlan:
        states = _unique(tuple(state.state_id for state in self.states), "state")
        features = _unique(tuple(feature.feature_id for feature in self.features), "feature")
        _unique(tuple(scenario.scenario_id for scenario in self.scenarios), "scenario")
        _unique(self.assertion_ids, "assertion")
        for feature in self.features:
            if not _unique(feature.state_ids, "feature state") <= states:
                raise ValueError("feature references unknown state")
        feature_states = {feature.feature_id: feature.state_ids for feature in self.features}
        for scenario in self.scenarios:
            if scenario.feature_id not in features:
                raise ValueError("scenario references unknown feature")
            if scenario.start_state_id not in feature_states[scenario.feature_id]:
                raise ValueError("scenario start state does not belong to feature")
        if {scenario.feature_id for scenario in self.scenarios} != features:
            raise ValueError("every selected feature requires a scenario")
        return self


class AssertionResult(FrozenModel):
    assertion_id: Identifier
    status: Literal["passed", "failed", "blocked", "not_run"]
    evidence_sha256: Sha256 | None = None
    reason: Text | None = None

    @model_validator(mode="after")
    def validate_result(self) -> AssertionResult:
        if self.status in ("passed", "failed") and self.evidence_sha256 is None:
            raise ValueError("executed assertions require evidence")
        if self.status != "passed" and self.reason is None:
            raise ValueError("non-passing assertions require a reason")
        if self.status in ("blocked", "not_run") and self.evidence_sha256 is not None:
            raise ValueError("unexecuted assertions cannot carry result evidence")
        return self


class CoverageReport(FrozenModel):
    schema_version: SchemaVersion
    attempt_id: Identifier
    plan: RecordedDemoPlan
    results: tuple[AssertionResult, ...] = Field(min_length=1, max_length=10_000)

    @model_validator(mode="after")
    def validate_results(self) -> CoverageReport:
        found = _unique(tuple(result.assertion_id for result in self.results), "result")
        if found != set(self.plan.assertion_ids):
            raise ValueError("results must cover exactly the selected assertions")
        return self

    @property
    def summary(self) -> dict[str, int]:
        counts = {
            "required": len(self.results),
            "passed": 0,
            "failed": 0,
            "blocked": 0,
            "not_run": 0,
        }
        for result in self.results:
            counts[result.status] += 1
        return counts

    @property
    def selected_scope_passed(self) -> bool:
        return all(result.status == "passed" for result in self.results)


class RecordedClip(FrozenModel):
    clip_id: Identifier
    path: RelativePath
    sha256: Sha256
    frame_count: Annotated[int, Field(strict=True, ge=1)]
    fps: FrameRate


class RecordedShot(FrozenModel):
    shot_id: Identifier
    clip_id: Identifier
    assertion_id: Identifier
    start_frame: Frame
    end_frame: Frame
    source_in_frame: Frame
    caption: Annotated[Text, Field(max_length=90)]
    zoom: float = Field(default=1.2, ge=1, le=1.5, allow_inf_nan=False)
    zoom_ramp_frames: Annotated[int, Field(strict=True, ge=1)] = 12


class RecordedDemoSpec(FrozenModel):
    schema_version: SchemaVersion
    spec_id: Identifier
    revision: PositiveRevision
    coverage: CoverageReport
    fps: Literal[30]
    total_frames: Annotated[int, Field(strict=True, ge=30, le=108_000)]
    clips: tuple[RecordedClip, ...] = Field(min_length=1, max_length=100)
    shots: tuple[RecordedShot, ...] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_timeline(self) -> RecordedDemoSpec:
        _unique(tuple(clip.clip_id for clip in self.clips), "clip")
        _unique(tuple(shot.shot_id for shot in self.shots), "shot")
        clips = {clip.clip_id: clip for clip in self.clips}
        passed = {
            result.assertion_id: result.evidence_sha256
            for result in self.coverage.results
            if result.status == "passed"
        }
        cursor = 0
        for shot in self.shots:
            duration = shot.end_frame - shot.start_frame
            if shot.start_frame != cursor or duration <= 0:
                raise ValueError("shots must be positive and frame-contiguous")
            if 2 * shot.zoom_ramp_frames > duration:
                raise ValueError("zoom ramps exceed shot duration")
            if shot.assertion_id not in passed:
                raise ValueError("shots require a passed assertion")
            if shot.clip_id not in clips:
                raise ValueError("shot references unknown clip")
            clip = clips[shot.clip_id]
            if passed[shot.assertion_id] != clip.sha256:
                raise ValueError("shot clip must match assertion evidence hash")
            source_end = Fraction(shot.source_in_frame, clip.fps) + Fraction(duration, self.fps)
            if source_end > Fraction(clip.frame_count, clip.fps):
                raise ValueError("shot exceeds source bounds")
            cursor = shot.end_frame
        if cursor != self.total_frames:
            raise ValueError("shots must cover the total duration")
        return self
