"""Synthesizes human-like cursor trajectories using cubic Bezier curves and micro-jitter."""

from __future__ import annotations

import math
import random
from typing import NamedTuple


class Point(NamedTuple):
    """2D coordinate point."""

    x: float
    y: float


def generate_bezier_trajectory(
    start: Point,
    end: Point,
    steps: int = 40,
    deviation_scale: float = 0.25,
) -> list[Point]:
    """Calculate natural mouse curve between two points using randomized cubic Bezier math.

    Ensures smooth acceleration, ease-out deceleration, and subtle human motor jitter.
    """
    dx = end.x - start.x
    dy = end.y - start.y
    distance = math.hypot(dx, dy)

    # Perpendicular unit vector for natural arc deviation
    perp_x = -dy / (distance or 1.0)
    perp_y = dx / (distance or 1.0)

    # Randomized control points
    dev1 = (random.random() - 0.5) * distance * deviation_scale
    dev2 = (random.random() - 0.5) * distance * deviation_scale

    p1 = Point(
        start.x + dx * 0.25 + perp_x * dev1,
        start.y + dy * 0.25 + perp_y * dev1,
    )
    p2 = Point(
        start.x + dx * 0.75 + perp_x * dev2,
        start.y + dy * 0.75 + perp_y * dev2,
    )

    trajectory: list[Point] = []
    for i in range(steps + 1):
        t = i / steps
        # Non-linear easing (ease-out deceleration towards destination)
        eased_t = math.sin(t * math.pi / 2)

        u = 1.0 - eased_t
        x = (
            (u**3 * start.x)
            + (3 * u**2 * eased_t * p1.x)
            + (3 * u * eased_t**2 * p2.x)
            + (eased_t**3 * end.x)
        )
        y = (
            (u**3 * start.y)
            + (3 * u**2 * eased_t * p1.y)
            + (3 * u * eased_t**2 * p2.y)
            + (eased_t**3 * end.y)
        )

        # Micro-jitter simulating hand motor noise (only on internal points)
        jitter = (random.random() - 0.5) * 1.2 if 0 < i < steps else 0.0
        trajectory.append(Point(x + jitter, y + jitter))

    return trajectory


def smooth_scroll_steps(total_delta_y: int, step_count: int = 12) -> list[float]:
    """Generate decelerating scroll delta steps simulating human trackpad gesture."""
    if step_count <= 0:
        return [float(total_delta_y)]

    weights = [math.sin((i + 1) / step_count * (math.pi / 2)) for i in reversed(range(step_count))]
    weight_sum = sum(weights) or 1.0
    return [(w / weight_sum) * total_delta_y for w in weights]

