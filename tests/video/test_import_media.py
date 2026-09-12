import shutil
import subprocess

import pytest

from demoforge.video.import_media import MediaError, MediaPermission, inspect_media


@pytest.fixture
def permission():
    return MediaPermission(
        actor_id="test-operator",
        authorized=True,
        privacy_reviewed=True,
        provenance="Locally generated test pattern",
    )


@pytest.fixture
def recording(tmp_path):
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        pytest.fail("FFmpeg and ffprobe are required for media tests")
    target = tmp_path / "fixture.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=320x180:rate=30:duration=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            target.as_posix(),
        ],
        check=True,
        timeout=30,
        capture_output=True,
    )
    return target


def test_real_media_full_decode_and_hash(recording, permission):
    result = inspect_media(recording, permission)
    assert result.frame_count == 30
    assert result.duration_seconds == 1
    assert (result.width, result.height) == (320, 180)
    assert result.fps == 30
    assert len(result.sha256) == 64
    assert not result.has_audio


@pytest.mark.parametrize("field", ["authorized", "privacy_reviewed"])
def test_unapproved_media_is_rejected_before_tools(tmp_path, permission, field):
    permission = permission.model_copy(update={field: False})
    with pytest.raises(MediaError, match="permission|privacy"):
        inspect_media(tmp_path / "absent.mp4", permission)


def test_invalid_media_is_safe_error(tmp_path, permission):
    target = tmp_path / "broken.mp4"
    target.write_bytes(b"private-content-not-for-errors")
    with pytest.raises(MediaError) as caught:
        inspect_media(target, permission)
    assert "private-content" not in str(caught.value)


def test_media_limits(recording, permission):
    with pytest.raises(MediaError, match="byte"):
        inspect_media(recording, permission, max_bytes=10)
    with pytest.raises(MediaError, match="duration"):
        inspect_media(recording, permission, max_duration=0.5)


def test_playlists_are_not_accepted(tmp_path, permission):
    playlist = tmp_path / "remote.m3u8"
    playlist.write_text("#EXTM3U\nhttps://example.org/private.ts\n")
    with pytest.raises(MediaError, match="container"):
        inspect_media(playlist, permission)


def test_normalize_creates_verified_silent_30fps_copy(recording, permission, tmp_path):
    from demoforge.video.import_media import normalize_media

    target = tmp_path / "normalized.mp4"
    result = normalize_media(recording, target, permission)
    assert result.fps == 30
    assert result.frame_count == 30
    assert not result.has_audio
    with pytest.raises(MediaError, match="exists"):
        normalize_media(recording, target, permission)
