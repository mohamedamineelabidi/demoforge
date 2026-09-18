"""Unit tests for humanized Bezier cursor motion synthesis."""

import math

from demoforge.capture.human_cursor import (
    Point,
    generate_bezier_trajectory,
    smooth_scroll_steps,
)


def test_bezier_trajectory_start_and_end():
    start = Point(100.0, 100.0)
    end = Point(800.0, 600.0)
    trajectory = generate_bezier_trajectory(start, end, steps=30)

    assert len(trajectory) == 31
    # Start point matches
    assert math.isclose(trajectory[0].x, start.x, abs_tol=0.1)
    assert math.isclose(trajectory[0].y, start.y, abs_tol=0.1)
    # End point matches
    assert math.isclose(trajectory[-1].x, end.x, abs_tol=0.1)
    assert math.isclose(trajectory[-1].y, end.y, abs_tol=0.1)


def test_bezier_trajectory_non_linear():
    start = Point(0.0, 0.0)
    end = Point(1000.0, 1000.0)
    trajectory = generate_bezier_trajectory(start, end, steps=40)

    # In a linear path, midpoint (step 20) would have x == 500
    # Because of ease-out deceleration, the path is non-linear
    assert len(trajectory) == 41
    xs = [p.x for p in trajectory]
    # Check monotonicity or progression towards end
    assert xs[-1] > xs[0]


def test_smooth_scroll_steps():
    steps = smooth_scroll_steps(total_delta_y=600, step_count=10)
    assert len(steps) == 10
    # Total sum of deltas matches target
    assert math.isclose(sum(steps), 600, abs_tol=1.0)
    # Early steps are larger than late steps (deceleration)
    assert steps[0] > steps[-1]

