"""Compiles discovered UI inventory into an actionable Hybrid Demo Spec with camera motion."""

from __future__ import annotations

import re
from typing import Any

from demoforge.schemas.recorded_demo import DiscoveredAppInventory

ACCENT_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#237454", "#06B6D4"]


def _clean_caption(text: str, max_len: int = 90) -> str:
    """Ensure caption is free of banned chars and conforms to length limit."""
    cleaned = re.sub(r"[<>\x00-\x1f]", "", text).strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len - 3] + "..."
    return cleaned


def compile_hybrid_spec(
    inventory: DiscoveredAppInventory,
    *,
    goal: str | None = None,
    fps: int = 30,
) -> dict[str, Any]:
    """Compile discovered app features into a polished Google Workspace-style walkthrough spec."""
    title = inventory.title or "Application Demo"
    tagline = goal or "Feature Walkthrough and Workflow Demo"

    targets = list(inventory.targets)
    if not targets:
        # Fallback synthetic shots if empty DOM
        return {
            "title": title,
            "tagline": _clean_caption(tagline),
            "fps": fps,
            "width": 1920,
            "height": 1080,
            "introDuration": 90,
            "outroDuration": 120,
            "shots": [
                {
                    "id": "overview",
                    "title": "Application Overview",
                    "caption": "Explore the primary application workspace and navigation.",
                    "source": "footage/library.webm",
                    "durationInFrames": 180,
                    "sourceInSeconds": 0.0,
                    "focus": {"x": 640.0, "y": 360.0},
                    "zoomAmount": 1.15,
                    "badge": {
                        "text": "1. Overview",
                        "frame": 20,
                        "color": "#6366F1",
                        "x": 180,
                        "y": 120,
                    },
                }
            ],
        }

    # Group targets into stages: navigation -> interaction -> action/result
    nav_targets = [t for t in targets if t.role in ("link", "heading")]
    input_targets = [t for t in targets if t.role == "input"]
    button_targets = [t for t in targets if t.role == "button"]

    selected_targets = []
    if nav_targets:
        selected_targets.append(nav_targets[0])
    if input_targets:
        selected_targets.append(input_targets[0])
    for b in button_targets:
        if b not in selected_targets:
            selected_targets.append(b)
            if len(selected_targets) >= 5:
                break

    # If still fewer than 3, add whatever remains
    for t in targets:
        if t not in selected_targets:
            selected_targets.append(t)
            if len(selected_targets) >= 4:
                break

    shots = []
    # Mapping to existing standard footage clips for rendering parity
    standard_clips = [
        ("footage/library.webm", 3.0),
        ("footage/canvas.webm", 2.8),
        ("footage/frames.webm", 2.8),
        ("footage/approvals.webm", 2.7),
        ("footage/review.webm", 2.8),
    ]

    for idx, target in enumerate(selected_targets):
        color = ACCENT_COLORS[idx % len(ACCENT_COLORS)]
        step_num = idx + 1
        clip_source, source_in = standard_clips[idx % len(standard_clips)]

        label = target.label
        if target.role == "button":
            caption = f"Trigger action: {label}."
        elif target.role == "input":
            caption = f"Configure field: {label}."
        else:
            caption = f"Inspect section: {label}."

        center_x, center_y = target.center

        shots.append(
            {
                "id": f"shot-{step_num}",
                "title": _clean_caption(label, 40),
                "caption": _clean_caption(caption, 90),
                "source": clip_source,
                "durationInFrames": 210,  # 7 seconds each
                "sourceInSeconds": source_in,
                "focus": {
                    "x": max(100.0, min(1820.0, center_x)),
                    "y": max(100.0, min(980.0, center_y)),
                },
                "zoomAmount": 1.20 if target.role != "heading" else 1.12,
                "badge": {
                    "text": f"{step_num}. {label[:28]}",
                    "frame": 22,
                    "color": color,
                    "x": 180,
                    "y": 120,
                },
            }
        )

    return {
        "title": title,
        "tagline": _clean_caption(tagline),
        "fps": fps,
        "width": 1920,
        "height": 1080,
        "introDuration": 90,
        "outroDuration": 120,
        "shots": shots,
    }

