"""TASK-070 gate: transition legality, duplicate execution, approvals, cancellation, budgets."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from demoforge.pack import RunWorkspace, WorkspaceConfig
from demoforge.schemas import Approval
from demoforge.workflow import StateStore
from demoforge.workflow.controller import (
    ApprovalRequired,
    Controller,
    RunCancelled,
    RunFailed,
)
from demoforge.workflow.stages import (
    ContentError,
    Stage,
    StageContext,
    StageOutcome,
    StageRequest,
    TransientError,
)

SHA256 = "b" * 64


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 9, 12, 10, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.t


class FakeStage(Stage):
    """Publishes one small JSON artifact. Optional scripted failures and approval subject."""

    def __init__(
        self,
        stage_id: str,
        run_state: str,
        *,
        approval: tuple[str, str] | None = None,
        fail: list[Exception] | None = None,
    ) -> None:
        self.stage_id = stage_id
        self.run_state = run_state
        self.approval_subject = approval  # (subject_type, subject_id)
        self._fail = list(fail or [])
        self.calls = 0
        self.repairs: list[str] = []

    def run(self, request: StageRequest, ctx: StageContext) -> StageOutcome:
        self.calls += 1
        if request.repair_hint:
            self.repairs.append(request.repair_hint)
        if self._fail:
            raise self._fail.pop(0)
        ref = ctx.workspace.publish_bytes(
            f"curated/{self.stage_id}.json",
            b'{"ok": true}',
            media_type="application/json",
            artifact_id=f"art_{self.stage_id}",
        )
        subject = None
        if self.approval_subject:
            subject = (self.approval_subject[0], self.approval_subject[1], 1, ref.sha256)
        return StageOutcome(outputs=[ref], approval_subject=subject)


@pytest.fixture
def config(tmp_path: Path) -> WorkspaceConfig:
    return WorkspaceConfig(root=tmp_path / "ws")


@pytest.fixture
def store(config: WorkspaceConfig) -> StateStore:
    s = StateStore.open(config.state_db, clock=Clock())
    yield s
    s.close()


def _pipeline(**overrides: FakeStage) -> list[FakeStage]:
    defaults = {
        "ingest": FakeStage("ingest", "ingesting"),
        "plan": FakeStage("plan", "planning", approval=("claims", "cat_1")),
        "footage": FakeStage("footage", "acquiring_footage"),
        "storyboard": FakeStage("storyboard", "storyboarding", approval=("storyboard", "sb_1")),
        "render": FakeStage("render", "rendering"),
        "review": FakeStage("review", "reviewing", approval=("output", "final_mp4")),
    }
    defaults.update(overrides)
    return list(defaults.values())


def _approve(store: StateStore, run_id: str, subject_type: str, subject_id: str, sha: str) -> None:
    store.record_approval(
        Approval(
            schema_version=1,
            approval_id=f"apr_{subject_type}_{sha[:6]}_{len(store.events(run_id))}",
            run_id=run_id,
            subject_type=subject_type,  # type: ignore[arg-type]
            subject_id=subject_id,
            subject_revision=1,
            subject_sha256=sha,
            actor_id="operator:test",
            decision="approved",
            decided_at="2026-09-12T10:00:00Z",
            note=None,
        )
    )


def _drive_to_completion(ctl: Controller, run_id: str, store: StateStore) -> None:
    for _ in range(10):
        try:
            ctl.resume(run_id)
            return
        except ApprovalRequired as need:
            _approve(store, run_id, need.subject_type, need.subject_id, need.subject_sha256)
    raise AssertionError("did not complete")


# -- happy path ----------------------------------------------------------------------------------


def test_full_run_pauses_at_each_approval_then_completes(config, store) -> None:
    stages = _pipeline()
    ctl = Controller(store, config, stages)
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired) as need:
        ctl.resume("run_a")
    assert need.value.subject_type == "claims"
    run = store.get_run("run_a")
    assert run.state == "awaiting_approval"
    assert run.checkpoint == {
        "subject_type": "claims",
        "subject_id": "cat_1",
        "subject_revision": 1,
        "subject_sha256": need.value.subject_sha256,
        "continue_with": "footage",
    }
    # Resume without an approval: still paused, and the stage is NOT re-run.
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    assert stages[1].calls == 1

    _drive_to_completion(ctl, "run_a", store)
    assert store.get_run("run_a").state == "complete"
    assert [s.calls for s in stages] == [1, 1, 1, 1, 1, 1]
    for s in stages:
        assert store.latest_manifest("run_a", s.stage_id) is not None


def test_manifest_records_inputs_from_previous_stages(config, store) -> None:
    ctl = Controller(store, config, _pipeline())
    ctl.create("run_a")
    _drive_to_completion(ctl, "run_a", store)
    render = store.latest_manifest("run_a", "render")
    storyboard = store.latest_manifest("run_a", "storyboard")
    assert render is not None and storyboard is not None
    assert storyboard.manifest_id in render.input_manifest_ids
    assert storyboard.outputs[0].sha256 in render.input_hashes


# -- approvals -----------------------------------------------------------------------------------


def test_stale_approval_does_not_unblock(config, store) -> None:
    ctl = Controller(store, config, _pipeline())
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    _approve(store, "run_a", "claims", "cat_1", "c" * 64)  # wrong hash
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    assert store.get_run("run_a").state == "awaiting_approval"


def test_rejection_fails_the_run(config, store) -> None:
    ctl = Controller(store, config, _pipeline())
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired) as need:
        ctl.resume("run_a")
    store.record_approval(
        Approval(
            schema_version=1,
            approval_id="apr_reject",
            run_id="run_a",
            subject_type="claims",
            subject_id="cat_1",
            subject_revision=1,
            subject_sha256=need.value.subject_sha256,
            actor_id="operator:test",
            decision="rejected",
            decided_at="2026-09-12T10:00:00Z",
            note="wrong claim",
        )
    )
    with pytest.raises(RunFailed, match="rejected"):
        ctl.resume("run_a")
    assert store.get_run("run_a").state == "failed"


# -- duplicate execution / resume --------------------------------------------------------------


def test_completed_stages_are_not_rerun_on_resume(config, store) -> None:
    stages = _pipeline(ingest=FakeStage("ingest", "ingesting"))
    ctl = Controller(store, config, stages)
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    # Simulate a fresh process: new controller over the same DB.
    ctl2 = Controller(store, config, stages)
    with pytest.raises(ApprovalRequired):
        ctl2.resume("run_a")
    assert stages[0].calls == 1


def test_terminal_run_cannot_resume(config, store) -> None:
    ctl = Controller(store, config, _pipeline())
    ctl.create("run_a")
    _drive_to_completion(ctl, "run_a", store)
    with pytest.raises(RunFailed, match="terminal"):
        ctl.resume("run_a")


# -- cancellation --------------------------------------------------------------------------------


def test_cancellation_is_honoured_between_stages(config, store) -> None:
    stages = _pipeline()
    ctl = Controller(store, config, stages)
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    ctl.cancel("run_a")
    with pytest.raises(RunCancelled):
        ctl.resume("run_a")
    assert store.get_run("run_a").state == "cancelled"
    assert stages[2].calls == 0
    ws = RunWorkspace.create(config, "run_a")
    assert list((ws.path / "raw").iterdir()) == []


# -- failure budgets -----------------------------------------------------------------------------


def test_transient_errors_retry_up_to_three_attempts(config, store) -> None:
    flaky = FakeStage("ingest", "ingesting", fail=[TransientError("net"), TransientError("net")])
    ctl = Controller(store, config, _pipeline(ingest=flaky))
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    assert flaky.calls == 3
    assert store.attempt_count("run_a", "ingest") == 3
    assert store.latest_manifest("run_a", "ingest") is not None


def test_fourth_transient_failure_fails_the_run(config, store) -> None:
    dead = FakeStage("ingest", "ingesting", fail=[TransientError("x")] * 3)
    ctl = Controller(store, config, _pipeline(ingest=dead))
    ctl.create("run_a")
    with pytest.raises(RunFailed, match="transient budget"):
        ctl.resume("run_a")
    assert dead.calls == 3
    assert store.get_run("run_a").state == "failed"


def test_content_error_gets_exactly_one_repair(config, store) -> None:
    bad = FakeStage(
        "plan", "planning", approval=("claims", "cat_1"), fail=[ContentError("dangling")]
    )
    ctl = Controller(store, config, _pipeline(plan=bad))
    ctl.create("run_a")
    with pytest.raises(ApprovalRequired):
        ctl.resume("run_a")
    assert bad.calls == 2
    assert bad.repairs == ["dangling"]


def test_second_content_error_fails_without_more_repairs(config, store) -> None:
    bad = FakeStage("plan", "planning", fail=[ContentError("a"), ContentError("b")])
    ctl = Controller(store, config, _pipeline(plan=bad))
    ctl.create("run_a")
    with pytest.raises(RunFailed, match="repair budget"):
        ctl.resume("run_a")
    assert bad.calls == 2


# -- invalidation --------------------------------------------------------------------------------


def test_invalidate_from_stage_reruns_only_downstream(config, store) -> None:
    stages = _pipeline()
    ctl = Controller(store, config, stages)
    ctl.create("run_a")
    _drive_to_completion(ctl, "run_a", store)

    ctl.invalidate_from("run_a", "storyboard")  # caption edit
    run = store.get_run("run_a")
    assert run.state == "storyboarding"
    _drive_to_completion(ctl, "run_a", store)
    assert [s.calls for s in stages] == [1, 1, 1, 2, 2, 2]
    assert store.get_run("run_a").state == "complete"


def test_invalidate_unknown_stage_rejected(config, store) -> None:
    ctl = Controller(store, config, _pipeline())
    ctl.create("run_a")
    with pytest.raises(ValueError, match="unknown stage"):
        ctl.invalidate_from("run_a", "nope")
