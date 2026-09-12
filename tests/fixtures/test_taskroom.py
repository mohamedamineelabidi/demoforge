"""Offline tests for the seeded taskroom fixture app and its loopback server."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest

from demoforge.fixtures.server import serve

REPO_ROOT = Path(__file__).resolve().parents[2]
TASKROOM = REPO_ROOT / "fixtures" / "taskroom"

REQUIRED_TESTIDS = [
    "filter-all",
    "filter-active",
    "filter-completed",
    "task-item",
    "task-count",
]


@pytest.fixture(scope="module")
def taskroom_url() -> Iterator[str]:
    url, stop = serve(TASKROOM)
    try:
        yield url
    finally:
        stop()


def _get(url: str) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:  # noqa: S310
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def test_fixture_files_exist() -> None:
    for name in ("index.html", "app.js", "style.css"):
        assert (TASKROOM / name).is_file(), name


def test_server_binds_loopback_and_serves_index(taskroom_url: str) -> None:
    assert taskroom_url.startswith("http://127.0.0.1:")
    status, body = _get(taskroom_url + "/")
    assert status == 200
    assert body == (TASKROOM / "index.html").read_bytes()
    status, body = _get(taskroom_url + "/app.js")
    assert status == 200
    assert body == (TASKROOM / "app.js").read_bytes()


def test_server_refuses_traversal(taskroom_url: str) -> None:
    for path in ("/../pyproject.toml", "/..%2fpyproject.toml", "/%2e%2e/pyproject.toml"):
        status, body = _get(taskroom_url + path)
        assert status in (400, 403, 404), path
        assert b"[project]" not in body


def test_server_has_no_directory_listing(taskroom_url: str) -> None:
    status, body = _get(taskroom_url + "/nope/")
    assert status == 404
    assert b"Directory listing" not in body


def test_server_stop_is_idempotent() -> None:
    url, stop = serve(TASKROOM)
    stop()
    stop()
    with pytest.raises((urllib.error.URLError, ConnectionError, OSError)):
        urllib.request.urlopen(url + "/", timeout=1)  # noqa: S310


def test_index_contains_all_testids() -> None:
    html = (TASKROOM / "index.html").read_text(encoding="utf-8")
    js = (TASKROOM / "app.js").read_text(encoding="utf-8")
    combined = html + js
    for testid in REQUIRED_TESTIDS:
        assert f'data-testid="{testid}"' in combined or f'"{testid}"' in js, testid
    # Static controls must be present in the HTML itself.
    for testid in ("filter-all", "filter-active", "filter-completed", "task-count"):
        assert f'data-testid="{testid}"' in html, testid


def test_index_is_offline_and_styled() -> None:
    html = (TASKROOM / "index.html").read_text(encoding="utf-8")
    css = (TASKROOM / "style.css").read_text(encoding="utf-8")
    assert "http://" not in html and "https://" not in html
    assert 'src="app.js"' in html
    assert 'href="style.css"' in html
    assert "Demo data" in html
    assert "#2563EB" in css.upper()


def test_app_js_has_no_randomness_timers_or_network() -> None:
    js = (TASKROOM / "app.js").read_text(encoding="utf-8")
    for banned in ("Math.random", "setTimeout", "setInterval", "fetch(", "XMLHttpRequest", "Date."):
        assert banned not in js, banned


def _seed_tasks() -> list[dict]:
    js = (TASKROOM / "app.js").read_text(encoding="utf-8")
    match = re.search(r"const SEED_TASKS\s*=\s*(\[.*?\]);", js, re.S)
    assert match, "SEED_TASKS constant not found"
    return json.loads(match.group(1))


def test_seed_has_eight_tasks_three_completed() -> None:
    tasks = _seed_tasks()
    assert len(tasks) == 8
    assert sum(1 for t in tasks if t["completed"] is True) == 3
    assert len({t["id"] for t in tasks}) == 8
    assert all(t["title"].strip() for t in tasks)
