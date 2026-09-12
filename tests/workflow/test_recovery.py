"""TASK-069 gate: crash recovery, snapshot export/import and terminal cleanup."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from demoforge.pack import RunWorkspace, WorkspaceConfig
from demoforge.schemas import Approval, ArtifactManifest, Cost
from demoforge.workflow import StateStore
from demoforge.workflow.recovery import (
    export_snapshot,
    finalize_run,
    import_snapshot,
    recover_stale_attempts,
)

SHA256 = "b" * 64


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 9, 12, 10, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.t


@pytest.fixture
def config(tmp_path: Path) -> WorkspaceConfig:
    return WorkspaceConfig(root=tmp_path / "ws")


@pytest.fixture
def store(config: WorkspaceConfig) -> StateStore:
    s = StateStore.open(config.state_db, clock=Clock())
    yield s
    s.close()


def _manifest(run_id: str, attempt_id: str, ws: RunWorkspace) -> ArtifactManifest:
    ref = ws.publish_bytes(
        "curated/x.json", b"{}", media_type="application/json", artifact_id="art_x"
    )
    return ArtifactManifest(
        schema_version=1,
        manifest_id=f"man_{attempt_id}",
        run_id=run_id,
        stage_id="ingest",
        attempt_id=attempt_id,
        revision=1,
        created_at="2026-09-12T10:00:00Z",
        input_manifest_ids=[],
        input_hashes=[],
        options_hash=SHA256,
        tool_versions={"python": "3.11"},
        schema_versions={"manifest": 1},
        template_version="v1",
        model_id=None,
        prompt_hash=None,
        outputs=[ref],
        gate="pass",
        cost=Cost(currency="USD", model=None, compute=None, storage=None, total=None),
    )


# -- crash after write ---------------------------------------------------------------------------


def test_crash_after_write_leaves_no_partial_publish(config: WorkspaceConfig) -> None:
    ws = RunWorkspace.create(config, "run_a")
    # Simulate a crash: a temp file from an interrupted publish is left behind.
    (ws.path / "curated").mkdir(exist_ok=True)
    stray = ws.path / "curated" / ".publish-dead.tmp"
    stray.write_bytes(b"partial")
    assert not (ws.path / "curated" / "target.json").exists()
    removed = ws.sweep_temp_files()
    assert removed == 1
    assert not stray.exists()


def test_running_attempt_after_crash_is_marked_failed_on_recovery(store: StateStore) -> None:
    store.create_run("run_a", input_manifest_id=None)
    store.transition("run_a", "ingesting", current_stage="ingest")
    att = store.begin_attempt("run_a", "ingest", idempotency_key="k1")
    # Process dies here. On restart the DB still says "running"; that can never be true.
    recovered = recover_stale_attempts(store)
    assert recovered == [att.attempt_id]
    assert store.get_attempt(att.attempt_id).state == "failed"
    assert store.get_attempt(att.attempt_id).error == "interrupted: process exited mid-attempt"
    # The run is still resumable: a new attempt can start.
    again = store.begin_attempt("run_a", "ingest", idempotency_key="k1")
    assert again.number == 2


def test_recovery_is_idempotent(store: StateStore) -> None:
    store.create_run("run_a", input_manifest_id=None)
    store.transition("run_a", "ingesting", current_stage="ingest")
    store.begin_attempt("run_a", "ingest", idempotency_key="k1")
    assert len(recover_stale_attempts(store)) == 1
    assert recover_stale_attempts(store) == []


# -- snapshot export / import ---------------------------------------------------------------------


def test_snapshot_round_trip(config: WorkspaceConfig, store: StateStore, tmp_path: Path) -> None:
    ws = RunWorkspace.create(config, "run_a")
    store.create_run("run_a", input_manifest_id=None)
    store.transition("run_a", "ingesting", current_stage="ingest")
    att = store.begin_attempt("run_a", "ingest", idempotency_key="k1")
    store.finish_attempt(
        att.attempt_id, "complete", manifest=_manifest("run_a", att.attempt_id, ws)
    )
    store.record_approval(
        Approval(
            schema_version=1,
            approval_id="apr_1",
            run_id="run_a",
            subject_type="claims",
            subject_id="cat_1",
            subject_revision=1,
            subject_sha256=SHA256,
            actor_id="operator:amine",
            decision="approved",
            decided_at="2026-09-12T10:00:00Z",
            note=None,
        )
    )
    snap = export_snapshot(store, "run_a")
    assert snap["schema_version"] == 1
    assert snap["run"]["run_id"] == "run_a"
    assert len(snap["attempts"]) == 1 and len(snap["manifests"]) == 1
    assert len(snap["approvals"]) == 1 and snap["events"]

    out = tmp_path / "snap.json"
    out.write_text(json.dumps(snap), encoding="utf-8")

    other = StateStore.open(tmp_path / "other.sqlite", clock=Clock())
    try:
        import_snapshot(other, json.loads(out.read_text(encoding="utf-8")))
        assert other.get_run("run_a").state == "ingesting"
        assert other.get_attempt(att.attempt_id).state == "complete"
        assert other.get_manifest(f"man_{att.attempt_id}").outputs[0].artifact_id == "art_x"
        assert other.has_approval("run_a", "claims", "cat_1", 1, SHA256)
        assert export_snapshot(other, "run_a") == snap
    finally:
        other.close()


def test_import_rejects_unsupported_version(store: StateStore) -> None:
    with pytest.raises(ValueError, match="schema_version"):
        import_snapshot(store, {"schema_version": 2, "run": {}})


def test_import_refuses_to_overwrite_existing_run(store: StateStore) -> None:
    store.create_run("run_a", input_manifest_id=None)
    snap = export_snapshot(store, "run_a")
    with pytest.raises(ValueError, match="already exists"):
        import_snapshot(store, snap)


# -- cleanup on terminal states -------------------------------------------------------------------


@pytest.mark.parametrize("final", ["complete", "failed", "cancelled"])
def test_finalize_purges_quarantine_and_keeps_outputs(
    config: WorkspaceConfig, store: StateStore, final: str
) -> None:
    ws = RunWorkspace.create(config, "run_a")
    (ws.path / "raw" / "clone.tar").write_bytes(b"x")
    (ws.path / "staging" / "tmp.mp4").write_bytes(b"y")
    (ws.path / "outputs" / "final.mp4").write_bytes(b"z")
    store.create_run("run_a", input_manifest_id=None)
    store.transition("run_a", "ingesting", current_stage="ingest")
    if final == "complete":
        for s in ("planning", "acquiring_footage", "storyboarding", "rendering", "reviewing"):
            store.transition("run_a", s)
    finalize_run(store, ws, final)
    assert store.get_run("run_a").state == final
    assert not (ws.path / "raw" / "clone.tar").exists()
    assert not (ws.path / "staging" / "tmp.mp4").exists()
    assert (ws.path / "outputs" / "final.mp4").exists()
    assert store.get_run("run_a").retention_deadline is not None


def test_finalize_rejects_non_terminal(config: WorkspaceConfig, store: StateStore) -> None:
    ws = RunWorkspace.create(config, "run_a")
    store.create_run("run_a", input_manifest_id=None)
    with pytest.raises(ValueError, match="terminal"):
        finalize_run(store, ws, "planning")  # type: ignore[arg-type]
