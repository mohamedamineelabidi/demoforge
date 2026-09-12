"""Foreground inspection of attested local video, with no network media protocols."""

import hashlib
import json
import math
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path

from pydantic import Field

from demoforge.schemas._base import NonBlankStr, Sha256, StrictModel


class MediaError(ValueError):
    """Safe media gate failure."""


class MediaPermission(StrictModel):
    actor_id: NonBlankStr
    authorized: bool
    privacy_reviewed: bool
    provenance: NonBlankStr


class MediaInfo(StrictModel):
    schema_version: int = 1
    sha256: Sha256
    size_bytes: int = Field(gt=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    fps: float = Field(gt=0, allow_inf_nan=False)
    frame_count: int = Field(gt=0)
    duration_seconds: float = Field(gt=0, allow_inf_nan=False)
    has_audio: bool
    permission: MediaPermission


def _run(arguments: list[str], timeout: float) -> bytes:
    try:
        completed = subprocess.run(arguments, capture_output=True, timeout=timeout, check=True)
    except subprocess.TimeoutExpired:
        raise MediaError("media inspection timed out") from None
    except (OSError, subprocess.CalledProcessError):
        raise MediaError("media tool unavailable or decode failed") from None
    if len(completed.stdout) > 1_000_000:
        raise MediaError("media metadata byte limit exceeded")
    return completed.stdout


def inspect_media(
    source: Path,
    permission: MediaPermission,
    *,
    max_bytes: int = 256_000_000,
    max_duration: float = 300,
    max_pixels: int = 3840 * 2160,
    timeout: float = 60,
) -> MediaInfo:
    if not permission.authorized or not permission.privacy_reviewed:
        raise MediaError("permission and full privacy review are required")
    if source.suffix.lower() not in {".mp4", ".mov", ".webm", ".mkv"}:
        raise MediaError("unsupported media container")
    if source.is_symlink() or not source.is_file():
        raise MediaError("a regular local media file is required")
    before = source.stat()
    if not 0 < before.st_size <= max_bytes:
        raise MediaError("media byte limit exceeded")
    absolute = source.resolve().as_posix()
    common = [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-format_whitelist",
        "mov,matroska,webm",
        "-threads",
        "1",
    ]
    raw = _run(
        ["ffprobe", *common, "-show_streams", "-show_format", "-of", "json", absolute], timeout
    )
    try:
        metadata = json.loads(raw)
        streams = metadata["streams"]
        videos = [stream for stream in streams if stream["codec_type"] == "video"]
        if len(videos) != 1 or len(streams) > 4:
            raise MediaError("one video stream and at most four total streams required")
        video = videos[0]
        width, height = int(video["width"]), int(video["height"])
        duration = float(metadata["format"]["duration"])
        fps = float(Fraction(video["avg_frame_rate"]))
        if not math.isfinite(duration) or not 0 < duration <= max_duration:
            raise MediaError("media duration limit exceeded")
        if width * height > max_pixels or min(width, height) <= 0 or max(width, height) > 7680:
            raise MediaError("media pixel limit exceeded")
        if not 0 < fps <= 120:
            raise MediaError("media frame-rate limit exceeded")
        counted = json.loads(
            _run(
                [
                    "ffprobe",
                    *common,
                    "-count_frames",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=nb_read_frames",
                    "-of",
                    "json",
                    absolute,
                ],
                timeout,
            )
        )
        frames = int(counted["streams"][0]["nb_read_frames"])
        if frames <= 0 or frames > math.ceil(max_duration * 120):
            raise MediaError("media frame-count limit exceeded")
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
        if isinstance(error, MediaError):
            raise
        raise MediaError("invalid media metadata") from None
    _run(
        [
            "ffmpeg",
            *common,
            "-xerror",
            "-err_detect",
            "explode",
            "-i",
            absolute,
            "-map",
            "0:v:0",
            "-map",
            "0:a?",
            "-f",
            "null",
            "-",
        ],
        timeout,
    )
    digest = hashlib.sha256()
    with source.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    after = source.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise MediaError("media changed during inspection")
    return MediaInfo(
        sha256=digest.hexdigest(),
        size_bytes=after.st_size,
        width=width,
        height=height,
        fps=fps,
        frame_count=frames,
        duration_seconds=duration,
        has_audio=any(stream["codec_type"] == "audio" for stream in streams),
        permission=permission,
    )


def normalize_media(source: Path, target: Path, permission: MediaPermission) -> MediaInfo:
    inspect_media(source, permission)
    if target.exists():
        raise MediaError("normalized output already exists")
    if target.suffix.lower() != ".mp4" or not target.parent.is_dir():
        raise MediaError("normalized target requires an existing local directory and MP4 suffix")
    with tempfile.TemporaryDirectory(prefix="normalize-", dir=target.parent) as folder:
        temporary = Path(folder) / "normalized.mp4"
        _run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-protocol_whitelist",
                "file",
                "-format_whitelist",
                "mov,matroska,webm",
                "-threads",
                "1",
                "-i",
                source.resolve().as_posix(),
                "-map",
                "0:v:0",
                "-vf",
                "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-an",
                "-c:v",
                "libx264",
                "-threads",
                "1",
                "-pix_fmt",
                "yuv420p",
                "-map_metadata",
                "-1",
                temporary.as_posix(),
            ],
            120,
        )
        result = inspect_media(temporary, permission)
        if result.fps != 30:
            raise MediaError("normalization did not produce 30 fps")
        with target.open("xb") as destination, temporary.open("rb") as origin:
            for chunk in iter(lambda: origin.read(1 << 20), b""):
                destination.write(chunk)
    return result
