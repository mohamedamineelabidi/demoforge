import hashlib
from types import SimpleNamespace

import pytest

from demoforge.ingest.github import Snapshot, SourceFile
from demoforge.pack.workspace import WorkspaceConfig
from demoforge.workflow.state import StateStore


def source(url):
    return Snapshot(
        url,
        "fixture/taskroom",
        "a" * 40,
        (SourceFile("README.md", b"# Taskroom\nFilter completed tasks.\n"),),
        0,
    )


@pytest.fixture
def dependencies():
    from demoforge.api.service import TeaserDependencies

    calls = []

    def prepare(catalog):
        from demoforge.schemas._base import StrictModel

        class Board(StrictModel):
            revision: int = 1
            scenes: list[dict]

        return Board(
            scenes=[
                {
                    "scene_id": str(index),
                    "kind": kind,
                    "start_frame": start,
                    "end_frame": end,
                    "text": "Taskroom",
                    "evidence_id": "source-0",
                }
                for index, (kind, start, end) in enumerate(
                    [
                        ("title", 0, 180),
                        ("feature", 180, 660),
                        ("end", 660, 900),
                    ]
                )
            ]
        )

    def render(spec, target):
        calls.append(spec)
        target.write_bytes(b"test-video")
        return dict(
            sha256=hashlib.sha256(b"test-video").hexdigest(),
            width=1920,
            height=1080,
            fps=30,
            frame_count=900,
            duration_seconds=30,
            has_audio=False,
        )

    return SimpleNamespace(
        deps=TeaserDependencies(
            source=source, prepare=prepare, validate=lambda *args: None, render=render
        ),
        calls=calls,
    )


def test_exact_approvals_refresh_and_export(tmp_path, dependencies):
    from demoforge.api.service import TeaserService

    config = WorkspaceConfig(tmp_path / "data")
    service = TeaserService(config, dependencies.deps)
    run = service.create("https://github.com/fixture/taskroom")
    run_id = run["run_id"]
    run = service.advance(run_id)
    assert run["checkpoint"]["subject_type"] == "storyboard"
    assert len(run["storyboard"]["scenes"]) == 3
    assert not dependencies.calls
    assert TeaserService(config, dependencies.deps).get(run_id) == run
    assert service.list_runs()[0]["run_id"] == run_id
    with pytest.raises(ValueError, match="approval"):
        service.approve(
            run_id,
            {**run["checkpoint"], "subject_sha256": "0" * 64},
            actor="test",
            note="Reviewed",
            reviewed=True,
        )
    assert not dependencies.calls
    service.approve(run_id, run["checkpoint"], actor="test", note="Reviewed", reviewed=True)
    run = service.advance(run_id)
    assert len(dependencies.calls) == 1
    assert run["checkpoint"]["subject_type"] == "output"
    assert run["preview_url"]
    with pytest.raises(ValueError, match="approval"):
        service.artifact(run_id, "bundle")
    service.approve(
        run_id, run["checkpoint"], actor="test", note="Full video reviewed", reviewed=True
    )
    run = service.advance(run_id)
    assert run["state"] == "complete"
    path, ref = service.artifact(run_id, "bundle")
    assert path.is_file() and ref.media_type == "application/zip"
    store = StateStore.open(config.state_db)
    try:
        assert store.connection.execute("SELECT count(*) FROM approvals").fetchone()[0] == 2
    finally:
        store.close()
    video_path, _ = service.artifact(run_id, "preview")
    video_path.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="integrity"):
        service.artifact(run_id, "preview")


def test_cancel_and_artifact_integrity(tmp_path, dependencies):
    from demoforge.api.service import TeaserService

    service = TeaserService(WorkspaceConfig(tmp_path / "data"), dependencies.deps)
    run = service.create("https://github.com/fixture/taskroom")
    assert service.cancel(run["run_id"])["state"] == "cancelled"
    assert not dependencies.calls
    with pytest.raises(ValueError):
        service.get("../secrets")


def test_interrupted_teaser_attempt_recovery_is_scoped(tmp_path, dependencies):
    from demoforge.api.service import TeaserService

    config = WorkspaceConfig(tmp_path / "data")
    service = TeaserService(config, dependencies.deps)
    run_id = service.create("https://github.com/fixture/taskroom")["run_id"]
    store = StateStore.open(config.state_db)
    try:
        store.transition(run_id, "ingesting", current_stage="teaser-source")
        attempt = store.begin_attempt(run_id, "teaser-source", idempotency_key="interrupted")
        store.create_run("unrelated", input_manifest_id=None)
        unrelated = store.begin_attempt("unrelated", "source", idempotency_key="other-lane")
    finally:
        store.close()
    service.recover()
    store = StateStore.open(config.state_db)
    try:
        assert (
            store.connection.execute(
                "SELECT state FROM attempts WHERE attempt_id = ?", (attempt.attempt_id,)
            ).fetchone()[0]
            == "failed"
        )
        assert (
            store.connection.execute(
                "SELECT state FROM attempts WHERE attempt_id = ?", (unrelated.attempt_id,)
            ).fetchone()[0]
            == "running"
        )
    finally:
        store.close()
    assert service.advance(run_id)["checkpoint"]["subject_type"] == "storyboard"
