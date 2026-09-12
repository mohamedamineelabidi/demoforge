import subprocess
from datetime import UTC, datetime

import pytest

from demoforge.schemas.approval import Approval
from demoforge.video.assemble import render_video
from demoforge.video.import_media import MediaPermission
from demoforge.video.storyboard import Scenario, Scene, Storyboard, artifact_hash
from tests.video.test_storyboard import catalog, proposal


def render_inputs(media_hash="d" * 64):
    source = catalog()
    proposed = proposal().model_copy(update={"catalog_sha256": artifact_hash(source)})
    scenario = Scenario(
        scenario_id="scenario",
        revision=1,
        proposal_sha256=artifact_hash(proposed),
        media_sha256=media_hash,
        source_in=[0, 0, 0],
    )
    board = Storyboard(
        storyboard_id="board",
        revision=1,
        proposal_sha256=artifact_hash(proposed),
        media_sha256=media_hash,
        media_frames=480,
        scenes=[
            Scene(start_frame=start, end_frame=end, source_in=0, caption=caption)
            for (start, end), caption in zip(
                [(0, 180), (180, 660), (660, 900)], proposed.captions, strict=True
            )
        ],
    )
    approvals = [
        Approval(
            schema_version=1,
            approval_id=kind,
            run_id="test-run",
            subject_type=kind,
            subject_id=identity,
            subject_revision=1,
            subject_sha256=artifact_hash(subject),
            actor_id="fixture-test",
            decision="approved",
            decided_at=datetime(2026, 9, 12, tzinfo=UTC),
            note="Synthetic test approval only",
        )
        for kind, identity, subject in [
            ("claims", proposed.proposal_id, proposed),
            ("scenario", scenario.scenario_id, scenario),
            ("storyboard", board.storyboard_id, board),
        ]
    ]
    return source, proposed, scenario, board, approvals


def test_render_without_approval_never_starts_tools(tmp_path):
    source, proposed, scenario, board, _ = render_inputs()
    permission = MediaPermission(
        actor_id="test", authorized=True, privacy_reviewed=True, provenance="Synthetic test pattern"
    )
    with pytest.raises(ValueError, match="approval"):
        render_video(
            tmp_path / "missing.mp4",
            tmp_path / "output.mp4",
            run_id="test-run",
            catalog=source,
            proposal=proposed,
            scenario=scenario,
            storyboard=board,
            approvals=[],
            permission=permission,
        )
    assert not (tmp_path / "output.mp4").exists()


def test_real_pilot_render_has_900_frames_and_full_decode(tmp_path):
    from demoforge.video.import_media import inspect_media

    source_file = tmp_path / "source.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=30:duration=16",
            "-c:v",
            "libx264",
            "-threads",
            "1",
            "-pix_fmt",
            "yuv420p",
            "-an",
            source_file.as_posix(),
        ],
        check=True,
        timeout=60,
        capture_output=True,
    )
    permission = MediaPermission(
        actor_id="fixture-test",
        authorized=True,
        privacy_reviewed=True,
        provenance="Synthetic local FFmpeg test pattern",
    )
    info = inspect_media(source_file, permission)
    source, proposed, scenario, board, approvals = render_inputs(info.sha256)
    target = tmp_path / "rendered.mp4"
    result = render_video(
        source_file,
        target,
        run_id="test-run",
        catalog=source,
        proposal=proposed,
        scenario=scenario,
        storyboard=board,
        approvals=approvals,
        permission=permission,
    )
    assert result.frame_count == 900
    assert result.duration_seconds == 30
    assert (result.width, result.height, result.fps) == (1920, 1080, 30)
    assert not result.has_audio
    assert len(result.sha256) == 64
    print(
        f"PILOT frames={result.frame_count} duration={result.duration_seconds} "
        f"sha256={result.sha256} output={target}"
    )
