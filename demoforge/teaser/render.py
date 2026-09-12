"""Offline generated typography, not source footage; approval belongs to the caller."""

import base64
import hashlib
import json
import os
import shutil
import tempfile
import time
from fractions import Fraction
from pathlib import Path
from typing import TYPE_CHECKING

from demoforge.video.import_media import MediaError, _run

if TYPE_CHECKING:
    from demoforge.schemas.teaser import TeaserSpec

_TEMPLATES = Path(__file__).parent / "templates"


def teaser_html(spec: "TeaserSpec") -> str:
    """Return a self-contained preview exposing deterministic renderFrame(frame)."""
    fields = (
        "schema_version", "revision", "product_name", "repository_url", "commit_sha",
        "catalog_sha256", "fps", "width", "height", "total_frames",
    )
    data = {field: getattr(spec, field) for field in fields}
    data["scenes"] = [
        {field: getattr(scene, field) for field in (
            "scene_id", "kind", "start_frame", "end_frame", "text", "evidence_id",
        )}
        for scene in spec.scenes
    ]
    serialized = json.dumps(data, ensure_ascii=True).replace("<", "\\u003c")
    serialized = serialized.replace(">", "\\u003e").replace("&", "\\u0026")
    script = "const spec = " + serialized + ";\n" + (
        _TEMPLATES / "timeline.js"
    ).read_text(encoding="utf-8")
    digest = base64.b64encode(hashlib.sha256(script.encode("utf-8")).digest()).decode("ascii")
    template = (_TEMPLATES / "teaser.html").read_text(encoding="utf-8")
    return template.replace("__SCRIPT_HASH__", digest).replace("__SCRIPT__", script)


def _inspect_generated(source: Path) -> dict:
    absolute = source.resolve().as_posix()
    metadata = json.loads(_run([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file", "-count_frames",
        "-show_streams", "-show_format", "-of", "json", absolute,
    ], 180))
    try:
        streams = metadata["streams"]
        if len(streams) != 1 or streams[0]["codec_type"] != "video":
            raise MediaError("generated teaser must have one silent video stream")
        video = streams[0]
        result = {
            "width": int(video["width"]), "height": int(video["height"]),
            "fps": float(Fraction(video["avg_frame_rate"])),
            "frame_count": int(video["nb_read_frames"]),
            "duration_seconds": float(metadata["format"]["duration"]),
            "has_audio": False,
        }
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        raise MediaError("invalid generated teaser metadata") from None
    if result != {
        "width": 1920, "height": 1080, "fps": 30, "frame_count": 900,
        "duration_seconds": 30, "has_audio": False,
    }:
        raise MediaError("teaser failed frame/dimension/duration gate")
    _run([
        "ffmpeg", "-v", "error", "-xerror", "-err_detect", "explode",
        "-protocol_whitelist", "file", "-threads", "1", "-i", absolute,
        "-map", "0:v:0", "-f", "null", "-",
    ], 180)
    motion_pairs = [(12, 60), (192, 240), (372, 420), (522, 600), (672, 750)]
    samples = [frame for pair in motion_pairs for frame in pair] + [810, 899]
    selection = "+".join(f"eq(n,{frame})" for frame in samples)
    raw = _run([
        "ffmpeg", "-v", "error", "-protocol_whitelist", "file", "-threads", "1",
        "-i", absolute, "-vf", f"select='{selection}'", "-fps_mode", "passthrough",
        "-f", "framemd5", "-",
    ], 180).decode("ascii")
    hashes = [line.rsplit(",", 1)[1].strip() for line in raw.splitlines()
              if line and not line.startswith("#")]
    if len(hashes) != len(samples):
        raise MediaError("expected motion samples were missing")
    by_frame = dict(zip(samples, hashes, strict=True))
    if any(by_frame[start] == by_frame[end] for start, end in motion_pairs):
        raise MediaError("expected motion samples did not differ")
    with source.open("rb") as handle:
        result["sha256"] = hashlib.file_digest(handle, "sha256").hexdigest()
    result["sample_frame_md5"] = dict(zip(map(str, samples), hashes, strict=True))
    return result


def render_teaser(spec: "TeaserSpec", target: Path) -> dict:
    """Render a validated, approved spec in the foreground and verify before publication.

    Requires the external Playwright 1.63.0 rig, installed Chrome, Node and FFmpeg.
    No MediaPermission is fabricated for generated artwork. Typical host runtime is
    several minutes; capture has a bounded 20-minute budget, encoding five minutes.
    """
    if target.exists() or target.is_symlink() or target.suffix.lower() != ".mp4":
        raise MediaError("render target must be a new MP4")
    if "onedrive" in str(target.resolve()).lower():
        raise MediaError("render output must be outside OneDrive")
    if (spec.width, spec.height, spec.fps, spec.total_frames) != (1920, 1080, 30, 900):
        raise MediaError("teaser requires 1920x1080, 30 fps and 900 frames")
    if [(scene.kind, scene.start_frame, scene.end_frame) for scene in spec.scenes] != [
        ("title", 0, 180), ("feature", 180, 660), ("end", 660, 900),
    ]:
        raise MediaError("teaser requires the three approved scene ranges")
    rig = Path(os.environ.get("DEMOFORGE_RIG", str(
        Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "demoforge-rig"
    )))
    try:
        package = json.loads((rig / "node_modules/playwright/package.json").read_text())
    except (OSError, ValueError):
        raise MediaError("pinned Playwright rig is not installed") from None
    if package.get("version") != "1.63.0":
        raise MediaError("teaser requires Playwright 1.63.0")
    started = time.monotonic()
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="teaser-", dir=target.parent) as folder:
        temporary = Path(folder)
        page = temporary / "preview.html"
        page.write_text(teaser_html(spec), encoding="utf-8")
        _run([
            "node", (_TEMPLATES / "capture.mjs").resolve().as_posix(),
            page.as_posix(), temporary.as_posix(), rig.resolve().as_posix(),
        ], 1200)
        capture = json.loads((temporary / "capture.json").read_text(encoding="utf-8"))
        final = temporary / "teaser.mp4"
        _run([
            "ffmpeg", "-v", "error", "-protocol_whitelist", "file",
            "-framerate", "30", "-i", (temporary / "frame-%04d.png").as_posix(),
            "-frames:v", "900", "-an", "-c:v", "libx264", "-threads", "2",
            "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-map_metadata", "-1", "-metadata", "comment=Generated typography; not a recording",
            "-movflags", "+faststart", final.as_posix(),
        ], 300)
        result = _inspect_generated(final)
        result.update({
            "origin": "generated_typography", "template_version": "2",
            "catalog_sha256": spec.catalog_sha256, "commit_sha": spec.commit_sha,
            "spec_revision": spec.revision, "captured_frames": capture["captured_frames"],
            "browser_version": capture["browser_version"], "playwright_version": "1.63.0",
            "render_seconds": round(time.monotonic() - started, 3),
        })
        with target.open("xb") as destination, final.open("rb") as origin:
            shutil.copyfileobj(origin, destination)
    return result