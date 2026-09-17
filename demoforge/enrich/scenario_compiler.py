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
    captured_sources: list[str] | None = None,
    target_url: str | None = None,
) -> dict[str, Any]:
    """Compile discovered app features into a polished Google Workspace-style walkthrough spec."""
    title = inventory.title or "Application Demo"
    tagline = goal or "Feature Walkthrough and Workflow Demo"
    effective_url = target_url or getattr(inventory, "url", "https://demo.app")

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

    GENERIC_LABELS = {
        "less", "more", "details", "click", "close", "cancel", "ok", "submit", "btn", "button",
        "read more", "learn more",
    }

    # Prefer descriptive targets over trivial UI buttons
    descriptive_targets = [t for t in targets if t.label.strip().lower() not in GENERIC_LABELS]
    pool = descriptive_targets if len(descriptive_targets) >= 2 else targets

    # Group targets into stages: navigation -> interaction -> action/result
    nav_targets = [t for t in pool if t.role in ("link", "heading")]
    input_targets = [t for t in pool if t.role == "input"]
    button_targets = [t for t in pool if t.role == "button"]

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

    # If still fewer than 4, add whatever remains in the pool
    for t in pool:
        if t not in selected_targets:
            selected_targets.append(t)
            if len(selected_targets) >= 5:
                break

    shots = []
    # Mapping to existing standard footage clips for fallback when no real footage captured
    standard_clips = [
        ("footage/library.webm", 3.0),
        ("footage/canvas.webm", 2.8),
        ("footage/frames.webm", 2.8),
        ("footage/approvals.webm", 2.7),
        ("footage/review.webm", 2.8),
    ]

    total_count = len(captured_sources) if captured_sources else min(len(selected_targets), 5)
    if total_count == 0:
        total_count = 1

    for idx in range(total_count):
        color = ACCENT_COLORS[idx % len(ACCENT_COLORS)]
        step_num = idx + 1

        if captured_sources:
            clip_source = captured_sources[idx]
            source_in = 0.0
        else:
            clip_source, source_in = standard_clips[idx % len(standard_clips)]

        target = selected_targets[idx] if idx < len(selected_targets) else None
        if target:
            label = target.label
            if target.role == "button":
                caption = f"Trigger action: {label}."
            elif target.role == "input":
                caption = f"Configure field: {label}."
            else:
                caption = f"Inspect section: {label}."
            center_x, center_y = target.center
            zoom = 1.20 if target.role != "heading" else 1.12
        else:
            label = f"App Feature {step_num}"
            caption = f"Explore application view {step_num}."
            center_x, center_y = 640.0, 360.0
            zoom = 1.15

        shots.append(
            {
                "id": f"shot-{step_num}",
                "title": _clean_caption(label, 40),
                "caption": _clean_caption(caption, 90),
                "source": clip_source,
                "url": effective_url,
                "durationInFrames": 210,  # 7 seconds each
                "sourceInSeconds": source_in,
                "focus": {
                    "x": max(100.0, min(1820.0, center_x)),
                    "y": max(100.0, min(980.0, center_y)),
                },
                "zoomAmount": zoom,
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
        "targetUrl": effective_url,
        "fps": fps,
        "width": 1920,
        "height": 1080,
        "introDuration": 90,
        "outroDuration": 120,
        "shots": shots,
    }

