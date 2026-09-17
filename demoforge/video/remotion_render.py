"""Bridges Python backend orchestration to Remotion video rendering and gate verification."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any


def prepare_render_props(spec: dict[str, Any], output_dir: Path) -> Path:
    """Serialize the spec dict to a JSON props file for Remotion."""
    output_dir.mkdir(parents=True, exist_ok=True)
    props_path = output_dir / "render_props.json"
    props_path.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    return props_path


def verify_rendered_video(video_path: Path, expected_frames: int | None = None) -> dict[str, Any]:
    """Perform hard ffprobe metadata and ffmpeg null-decode integrity verification."""
    if not video_path.exists():
        raise FileNotFoundError(f"Rendered video does not exist: {video_path}")

    # 1. ffprobe metadata extraction
    clean_path = str(video_path).replace("\\", "/")
    probe_cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-count_frames",
        "-show_entries", "stream=nb_read_frames,r_frame_rate,width,height,duration",
        "-of", "json",
        clean_path,
    ]
    proc = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
    probe_data = json.loads(proc.stdout)
    stream = probe_data["streams"][0]

    width = int(stream["width"])
    height = int(stream["height"])
    frame_count = int(stream["nb_read_frames"])
    duration = float(stream["duration"])
    fps = stream["r_frame_rate"]

    if expected_frames is not None and frame_count != expected_frames:
        raise ValueError(f"Frame count mismatch: expected {expected_frames}, got {frame_count}")

    # 2. ffmpeg full decode check
    decode_cmd = ["ffmpeg", "-v", "error", "-i", clean_path, "-f", "null", "-"]
    subprocess.run(decode_cmd, capture_output=True, text=True, check=True)

    # 3. SHA-256 hash calculation
    hasher = hashlib.sha256()
    with video_path.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    sha256_hash = hasher.hexdigest()

    return {
        "video_path": str(video_path),
        "width": width,
        "height": height,
        "frame_count": frame_count,
        "duration": duration,
        "fps": fps,
        "sha256": sha256_hash,
    }


def render_hybrid_video(
    spec: dict[str, Any],
    output_path: Path,
    *,
    project_dir: Path | None = None,
) -> dict[str, Any]:
    """Execute Remotion CLI foreground render and verify output artifact."""
    if project_dir is None:
        project_dir = Path(__file__).resolve().parents[2] / "demo-video"

    prepare_render_props(spec, project_dir / "public")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean_out = str(output_path).replace("\\", "/")

    cmd = [
        "npx",
        "remotion",
        "render",
        "HybridWalkthrough",
        clean_out,
    ]
    # Execute foreground render
    subprocess.run(cmd, cwd=str(project_dir), check=True, capture_output=True, text=True)

    # Calculate expected frame count
    intro = spec.get("introDuration", 90)
    outro = spec.get("outroDuration", 120)
    shots_duration = sum(s.get("durationInFrames", 210) for s in spec.get("shots", []))
    total_frames = intro + shots_duration + outro

    return verify_rendered_video(output_path, expected_frames=total_frames)

