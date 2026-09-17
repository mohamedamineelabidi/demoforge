"""Unit tests for the Remotion render pipeline bridge."""

import json
from pathlib import Path

from demoforge.video.remotion_render import prepare_render_props, verify_rendered_video


def test_prepare_render_props(tmp_path: Path):
    spec = {
        "title": "Test Walkthrough",
        "fps": 30,
        "introDuration": 90,
        "outroDuration": 90,
        "shots": [],
    }
    props_file = prepare_render_props(spec, output_dir=tmp_path)
    assert props_file.exists()
    loaded = json.loads(props_file.read_text())
    assert loaded["title"] == "Test Walkthrough"


def test_verify_rendered_video_checks_existing_artifact():
    # Test on our existing verified video if available
    reviews_dir = Path.home() / "AppData" / "Local" / "demoforge" / "reviews"
    video_path = reviews_dir / "hybrid-demo-v1" / "hybrid-walkthrough.mp4"
    if video_path.exists():
        report = verify_rendered_video(video_path, expected_frames=1350)
        assert report["frame_count"] == 1350
        assert report["width"] == 1920
        assert report["height"] == 1080
        assert len(report["sha256"]) == 64

