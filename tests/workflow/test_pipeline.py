import hashlib
import subprocess

import pytest

from demoforge.pack.workspace import RunWorkspace, WorkspaceConfig
from demoforge.schemas.approval import Approval
from demoforge.video.import_media import MediaInfo, MediaPermission
from demoforge.video.storyboard import artifact_hash
from demoforge.workflow.controller import ApprovalRequired
from demoforge.workflow.pipeline import pipeline_controller
from demoforge.workflow.state import StateStore
from tests.video.test_storyboard import catalog, proposal


def test_pipeline_pauses_and_resumes_exact_artifact_approvals(tmp_path, monkeypatch):
    source_catalog = catalog()
    proposed = proposal().model_copy(update={"catalog_sha256": artifact_hash(source_catalog)})
    for name, value in [("catalog", source_catalog), ("proposal", proposed)]:
        (tmp_path / f"{name}.json").write_text(value.model_dump_json(), encoding="utf-8")
    footage = tmp_path / "supplied.mp4"
    footage.write_bytes(b"mock-media")
    permission = MediaPermission(
        actor_id="test",
        authorized=True,
        privacy_reviewed=True,
        provenance="Synthetic controller test",
    )
    info = MediaInfo(
        sha256=hashlib.sha256(b"mock-media").hexdigest(),
        size_bytes=10,
        width=1920,
        height=1080,
        fps=30,
        frame_count=900,
        duration_seconds=30,
        has_audio=False,
        permission=permission,
    )

    def normalize(source, target, permission):
        target.write_bytes(b"mock-media")
        return info

    def render(source, target, **kwargs):
        target.write_bytes(b"mock-media")
        return info

    monkeypatch.setattr("demoforge.workflow.pipeline.normalize_media", normalize)
    monkeypatch.setattr("demoforge.workflow.pipeline.render_video", render)
    monkeypatch.setattr("demoforge.workflow.pipeline.inspect_media", lambda *args: info)
    config = WorkspaceConfig(tmp_path / "workspace")
    store = StateStore.open(config.state_db)
    try:
        controller = pipeline_controller(store, config)
        controller.create(
            "pipeline-test",
            options={
                "catalog": str(tmp_path / "catalog.json"),
                "proposal": str(tmp_path / "proposal.json"),
                "footage": str(footage),
                "permission": permission.model_dump(),
                "sanitized_catalog_confirmed": True,
            },
        )
        for expected in ["claims", "scenario", "storyboard", "output"]:
            controller = pipeline_controller(store, config)
            with pytest.raises(ApprovalRequired) as caught:
                controller.resume("pipeline-test")
            need = caught.value
            assert need.subject_type == expected
            workspace = RunWorkspace.create(config, "pipeline-test")
            assert not list(workspace.path.glob("outputs/export/*"))
            with pytest.raises(ApprovalRequired):
                controller.resume("pipeline-test")
            store.record_approval(
                Approval(
                    schema_version=1,
                    approval_id=expected,
                    run_id="pipeline-test",
                    subject_type=expected,
                    subject_id=need.subject_id,
                    subject_revision=need.subject_revision,
                    subject_sha256=need.subject_sha256,
                    actor_id="fixture-test",
                    decision="approved",
                    decided_at=store.now(),
                    note="Synthetic fixture decision only, full output reviewed in test",
                )
            )
        pipeline_controller(store, config).resume("pipeline-test")
        assert store.get_run("pipeline-test").state == "complete"
        assert (workspace.path / "outputs/export/video.mp4").read_bytes() == b"mock-media"
        exported = workspace.path / "outputs/export"
        assert {path.name for path in exported.iterdir()} == {
            "video.mp4",
            "catalog.json",
            "proposal.json",
            "scenario.json",
            "storyboard.json",
            "quality.json",
            "approval.json",
            "review.html",
        }
    finally:
        store.close()


def test_real_pipeline_exports_only_after_four_fixture_decisions(tmp_path):
    source_catalog = catalog()
    proposed = proposal().model_copy(update={"catalog_sha256": artifact_hash(source_catalog)})
    for name, value in [("catalog", source_catalog), ("proposal", proposed)]:
        (tmp_path / f"{name}.json").write_text(value.model_dump_json(), encoding="utf-8")
    footage = tmp_path / "source.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=30:duration=30",
            "-c:v",
            "libx264",
            "-threads",
            "1",
            "-pix_fmt",
            "yuv420p",
            "-an",
            footage.as_posix(),
        ],
        check=True,
        timeout=60,
        capture_output=True,
    )
    permission = MediaPermission(
        actor_id="fixture-test",
        authorized=True,
        privacy_reviewed=True,
        provenance="Synthetic local test pattern, not product footage",
    )
    config = WorkspaceConfig(tmp_path / "workspace")
    store = StateStore.open(config.state_db)
    try:
        pipeline_controller(store, config).create(
            "real-pipeline",
            options={
                "catalog": str(tmp_path / "catalog.json"),
                "proposal": str(tmp_path / "proposal.json"),
                "footage": str(footage),
                "permission": permission.model_dump(),
                "sanitized_catalog_confirmed": True,
            },
        )
        for expected in ["claims", "scenario", "storyboard", "output"]:
            with pytest.raises(ApprovalRequired) as caught:
                pipeline_controller(store, config).resume("real-pipeline")
            need = caught.value
            assert need.subject_type == expected
            store.record_approval(
                Approval(
                    schema_version=1,
                    approval_id=expected,
                    run_id="real-pipeline",
                    subject_type=expected,
                    subject_id=need.subject_id,
                    subject_revision=need.subject_revision,
                    subject_sha256=need.subject_sha256,
                    actor_id="fixture-test",
                    decision="approved",
                    decided_at=store.now(),
                    note="Synthetic test decision only, not a customer or human approval",
                )
            )
        pipeline_controller(store, config).resume("real-pipeline")
        workspace = RunWorkspace.create(config, "real-pipeline")
        target = workspace.resolve("outputs/export/video.mp4")
        from demoforge.video.import_media import inspect_media

        measured = inspect_media(target, permission)
        assert measured.frame_count == 900
        assert measured.duration_seconds == 30
        assert store.get_run("real-pipeline").state == "complete"
        pages = list(workspace.path.glob("outputs/*/review.html"))
        assert len(pages) == 2
        assert all((page.parent / "video.mp4").is_file() for page in pages)
        exported_page = workspace.resolve("outputs/export/review.html")
        assert "Operator-approved output" in exported_page.read_text(encoding="utf-8")
        print(
            f"REAL_PIPELINE frames={measured.frame_count} duration={measured.duration_seconds} "
            f"sha256={measured.sha256} review={pages[0]}"
        )
    finally:
        store.close()
