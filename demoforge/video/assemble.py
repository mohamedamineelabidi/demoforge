"""Approval-gated silent pilot render using real footage and offline HTML captions."""

import json
import os
import shutil
import tempfile
from pathlib import Path

from demoforge.brand.tokens import BrandTokens
from demoforge.schemas.approval import Approval
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.video.import_media import MediaError, MediaInfo, MediaPermission, _run, inspect_media
from demoforge.video.storyboard import Proposal, Scenario, Storyboard, validate_render_inputs


def render_video(
    source: Path,
    target: Path,
    *,
    run_id: str,
    catalog: EvidenceCatalog,
    proposal: Proposal,
    scenario: Scenario,
    storyboard: Storyboard,
    approvals: list[Approval],
    permission: MediaPermission,
    brand: BrandTokens | None = None,
) -> MediaInfo:
    validate_render_inputs(run_id, catalog, proposal, scenario, storyboard, approvals)
    info = inspect_media(source, permission)
    if info.sha256 != storyboard.media_sha256 or info.frame_count != storyboard.media_frames:
        raise MediaError("storyboard media identity or frame count mismatch")
    if info.fps != 30:
        raise MediaError("normalize footage to 30 fps before storyboarding")
    if target.exists() or target.suffix.lower() != ".mp4":
        raise MediaError("render target must be a new MP4")
    if "onedrive" in str(target.resolve()).lower():
        raise MediaError("render output must be outside OneDrive")
    if brand is not None and brand != storyboard.brand:
        raise MediaError("brand differs from approved storyboard")
    tokens = storyboard.brand
    rig = Path(
        os.environ.get(
            "DEMOFORGE_RIG",
            str(Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "demoforge-rig"),
        )
    )
    if not (rig / "node_modules" / "playwright" / "package.json").is_file():
        raise MediaError("pinned Playwright rig is not installed")
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="render-", dir=target.parent) as directory:
        temporary = Path(directory)
        manifest = temporary / "overlay.json"
        manifest.write_text(
            json.dumps(
                {
                    "captions": [scene.caption.text for scene in storyboard.scenes],
                    "foreground": tokens.foreground,
                }
            ),
            encoding="utf-8",
        )
        script = Path(__file__).parent / "overlay" / "render.mjs"
        _run(
            [
                "node",
                script.resolve().as_posix(),
                manifest.as_posix(),
                temporary.as_posix(),
                rig.resolve().as_posix(),
            ],
            120,
        )
        for index, scene in enumerate(storyboard.scenes):
            duration = scene.end_frame - scene.start_frame
            filters = (
                f"[0:v]trim=start_frame={scene.source_in}:end_frame={scene.source_in + duration},"
                "setpts=PTS-STARTPTS,"
                f"zoompan=z='1+({scene.zoom}-1)*on/{max(1, duration - 1)}':"
                f"x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={info.width}x{info.height}:fps=30,"
                "scale=1574:810:force_original_aspect_ratio=decrease,"
                f"pad=1920:1080:(ow-iw)/2:70:color={tokens.background}[base];"
                "[base][1:v]overlay=0:0:shortest=1,format=yuv420p[out]"
            )
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
                    "-loop",
                    "1",
                    "-i",
                    (temporary / f"caption-{index}.png").as_posix(),
                    "-filter_complex_threads",
                    "1",
                    "-filter_complex",
                    filters,
                    "-map",
                    "[out]",
                    "-frames:v",
                    str(duration),
                    "-r",
                    "30",
                    "-an",
                    "-c:v",
                    "libx264",
                    "-threads",
                    "2",
                    "-preset",
                    "fast",
                    "-crf",
                    "20",
                    "-map_metadata",
                    "-1",
                    (temporary / f"scene-{index}.mp4").as_posix(),
                ],
                180,
            )
        listing = temporary / "concat.txt"
        listing.write_text(
            "".join(f"file 'scene-{index}.mp4'\n" for index in range(3)), encoding="ascii"
        )
        final = temporary / "video.mp4"
        _run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-f",
                "concat",
                "-safe",
                "1",
                "-i",
                listing.as_posix(),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                final.as_posix(),
            ],
            60,
        )
        result = inspect_media(final, permission)
        if (
            result.frame_count != 900
            or result.fps != 30
            or result.width != 1920
            or result.height != 1080
            or abs(result.duration_seconds - 30) > 0.04
        ):
            raise MediaError("render failed pilot frame/dimension/duration gate")
        with target.open("xb") as destination, final.open("rb") as origin:
            shutil.copyfileobj(origin, destination)
    return result
