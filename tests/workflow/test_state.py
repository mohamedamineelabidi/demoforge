from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from demoforge.schemas import Approval, ArtifactManifest, ArtifactRef, Cost
from demoforge.workflow.state import (
    ConcurrencyError,
    IllegalTransitionError,
    StateStore,
    UnknownRunError,
)

SHA256 = "b" * 64
T0 = datetime(2026, 9, 12, 10, 0, tzinfo=UTC)


class FakeClock:
    def __init__(self) -> None:
        self.now_value = T0

    def now(self) -> datetime:
        return self.now_value


@pytest.fixture
def store(tmp_path: Path) -> StateStore:
    return StateStore.open(tmp_path / "state.sqlite", clock=FakeClock())


def _manifest(run_id: str, stage: str, attempt: str, gate: str = "pass") -> ArtifactManifest:
    outputs = (
        [
            ArtifactRef(
                artifact_id=f"{stage}_out",
                path=f"outputs/{stage}.json",
                sha256=SHA256,
                media_type="application/json",
                size_bytes=2,
            )
        ]
        if gate == "pass"
        else []
    )
    return ArtifactManifest(
        schema_version=1,
        manifest_id=f"man_{stage}_{attempt}",
        run_id=run_id,
        stage_id=stage,
        attempt_id=attempt,
        revision=1,
        created_at=T0,
        input_manifest_ids=[],
        input_hashes=[],
        options_hash=SHA256,
        tool_versions={},
        schema_versions={},
        template_version=None,
        model_id=None,
        prompt_hash=None,
        outputs=outputs,
        gate=gate,  # type: ignore[arg-type]
        cost=Cost(currency="USD", model=None, compute=None, storage=None, total=None),
    )


def test_create_run_is_pending(store: StateStore) -> None:
    run = store.create_run("run_001", input_manifest_id=None)
    assert run.state == "pending"
    assert run.run_id == "run_001"
    assert store.get_run("run_001").state == "pending"


def test_duplicate_run_id_rejected(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    with pytest.raises(ConcurrencyError):
        store.create_run("run_001", input_manifest_id=None)


def test_unknown_run(store: StateStore) -> None:
    with pytest.raises(UnknownRunError):
        store.get_run("nope")


def test_legal_transition_updates_state_and_timestamp(store: StateStore, tmp_path: Path) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "ingesting", current_stage="ingest")
    run = store.get_run("run_001")
    assert run.state == "ingesting"
    assert run.current_stage == "ingest"
    assert run.updated_at == T0


def test_illegal_transition_rejected(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    with pytest.raises(IllegalTransitionError):
        store.transition("run_001", "complete")


def test_terminal_states_do_not_transition(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "cancelled")
    with pytest.raises(IllegalTransitionError):
        store.transition("run_001", "ingesting")


def test_attempt_lifecycle(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "ingesting", current_stage="ingest")
    attempt = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    assert attempt.state == "running"
    assert attempt.number == 1
    store.finish_attempt(
        attempt.attempt_id, "complete", manifest=_manifest("run_001", "ingest", attempt.attempt_id)
    )
    assert store.get_attempt(attempt.attempt_id).state == "complete"
    assert (
        store.latest_manifest("run_001", "ingest").manifest_id == f"man_ingest_{attempt.attempt_id}"
    )


def test_only_one_running_attempt_per_stage(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    with pytest.raises(ConcurrencyError):
        store.begin_attempt("run_001", "ingest", idempotency_key="k2")


def test_attempt_numbers_increase(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    a1 = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    store.finish_attempt(a1.attempt_id, "failed", manifest=None, error="boom")
    a2 = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    assert a2.number == 2
    assert store.attempt_count("run_001", "ingest") == 2


def test_failed_attempt_cannot_publish_success_manifest(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    a1 = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    with pytest.raises(ValueError):
        store.finish_attempt(
            a1.attempt_id, "failed", manifest=_manifest("run_001", "ingest", a1.attempt_id)
        )


def test_manifest_must_match_attempt(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    a1 = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    with pytest.raises(ValueError):
        store.finish_attempt(
            a1.attempt_id, "complete", manifest=_manifest("run_001", "ingest", "other")
        )


def test_manifest_round_trips_through_sqlite(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    a1 = store.begin_attempt("run_001", "ingest", idempotency_key="k1")
    manifest = _manifest("run_001", "ingest", a1.attempt_id)
    store.finish_attempt(a1.attempt_id, "complete", manifest=manifest)
    assert store.get_manifest(manifest.manifest_id) == manifest


def test_approvals_are_recorded_and_queried_by_subject(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    approval = Approval(
        schema_version=1,
        approval_id="apr_1",
        run_id="run_001",
        subject_type="storyboard",
        subject_id="sb_1",
        subject_revision=2,
        subject_sha256=SHA256,
        actor_id="operator:amine",
        decision="approved",
        decided_at=T0,
        note=None,
    )
    store.record_approval(approval)
    assert store.has_approval("run_001", "storyboard", "sb_1", 2, SHA256)
    assert not store.has_approval("run_001", "storyboard", "sb_1", 3, SHA256)
    assert not store.has_approval("run_001", "storyboard", "sb_1", 2, "c" * 64)


def test_approval_is_immutable_in_store(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    approval = Approval(
        schema_version=1,
        approval_id="apr_1",
        run_id="run_001",
        subject_type="claims",
        subject_id="cat_1",
        subject_revision=1,
        subject_sha256=SHA256,
        actor_id="operator:amine",
        decision="approved",
        decided_at=T0,
        note=None,
    )
    store.record_approval(approval)
    with pytest.raises(ConcurrencyError):
        store.record_approval(approval.model_copy(update={"decision": "rejected"}))


def test_checkpoint_persists_for_resume(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "ingesting", current_stage="ingest")
    store.transition("run_001", "planning", current_stage="plan")
    store.transition(
        "run_001",
        "awaiting_approval",
        current_stage="plan",
        checkpoint={"subject_type": "claims", "subject_id": "cat_1", "continue_stage": "footage"},
    )
    run = store.get_run("run_001")
    assert run.checkpoint == {
        "subject_type": "claims",
        "subject_id": "cat_1",
        "continue_stage": "footage",
    }


def test_cancellation_flag_persists(store: StateStore) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.request_cancellation("run_001")
    assert store.get_run("run_001").cancellation_requested is True


def test_state_survives_reopen(tmp_path: Path) -> None:
    path = tmp_path / "state.sqlite"
    store = StateStore.open(path, clock=FakeClock())
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "ingesting", current_stage="ingest")
    store.close()
    reopened = StateStore.open(path, clock=FakeClock())
    assert reopened.get_run("run_001").state == "ingesting"


def test_events_are_diagnostic_only_and_sanitized(store: StateStore, tmp_path: Path) -> None:
    store.create_run("run_001", input_manifest_id=None)
    store.transition("run_001", "ingesting", current_stage="ingest")
    events = store.events("run_001")
    assert [e["event"] for e in events] == ["run_created", "transition"]
    assert all("token" not in str(e).lower() for e in events)
