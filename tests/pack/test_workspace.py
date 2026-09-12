from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from demoforge.pack.workspace import (
    PathEscapeError,
    RunWorkspace,
    WorkspaceConfig,
    resolve_workspace_root,
)


def test_root_from_env_wins(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("DEMOFORGE_WORKSPACE", str(tmp_path / "ws"))
    assert resolve_workspace_root() == (tmp_path / "ws").resolve()


def test_default_root_is_outside_repo_and_onedrive(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("DEMOFORGE_WORKSPACE", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "xdg"))
    root = resolve_workspace_root()
    assert "OneDrive" not in str(root)
    assert root.name == "demoforge"


def test_rejects_onedrive_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    bad = tmp_path / "OneDrive - Univ" / "ws"
    monkeypatch.setenv("DEMOFORGE_WORKSPACE", str(bad))
    with pytest.raises(ValueError, match="OneDrive"):
        resolve_workspace_root()


def test_run_workspace_creates_lake_layout(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    for sub in ("raw", "staging", "curated", "outputs"):
        assert (ws.path / sub).is_dir()
    assert ws.path == tmp_path / "runs" / "run_001"


def test_run_id_must_be_safe(tmp_path: Path) -> None:
    for bad in ("../x", "a/b", "", "run 1", "run\\1"):
        with pytest.raises(ValueError):
            RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id=bad)


def test_resolve_rejects_escape(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    for bad in ("../other", "/abs", "C:/x", "outputs/../../x"):
        with pytest.raises(PathEscapeError):
            ws.resolve(bad)


def test_resolve_rejects_symlink_escape(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    outside = tmp_path / "outside"
    outside.mkdir()
    link = ws.path / "outputs" / "link"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not permitted on this host")
    with pytest.raises(PathEscapeError):
        ws.resolve("outputs/link/file.txt")


def test_publish_is_atomic_and_hashed(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    payload = b"hello video"
    ref = ws.publish_bytes("outputs/hello.txt", payload, media_type="text/plain", artifact_id="a1")
    assert ref.sha256 == hashlib.sha256(payload).hexdigest()
    assert ref.size_bytes == len(payload)
    assert (ws.path / "outputs" / "hello.txt").read_bytes() == payload
    assert not list((ws.path / "outputs").glob("*.tmp*")), "no temp files left behind"


def test_verify_detects_hash_mismatch(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    ref = ws.publish_bytes("outputs/a.txt", b"one", media_type="text/plain", artifact_id="a1")
    assert ws.verify(ref) == []
    (ws.path / "outputs" / "a.txt").write_bytes(b"two")
    errors = ws.verify(ref)
    assert errors and "sha256" in errors[0]


def test_verify_detects_missing_file(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    ref = ws.publish_bytes("outputs/a.txt", b"one", media_type="text/plain", artifact_id="a1")
    (ws.path / "outputs" / "a.txt").unlink()
    assert any("missing" in e for e in ws.verify(ref))


def test_purge_quarantine_removes_raw_and_staging_only(tmp_path: Path) -> None:
    ws = RunWorkspace.create(WorkspaceConfig(root=tmp_path), run_id="run_001")
    (ws.path / "raw" / "secret.txt").write_text("x")
    (ws.path / "staging" / "s.txt").write_text("x")
    ws.publish_bytes("outputs/keep.txt", b"k", media_type="text/plain", artifact_id="k")
    removed = ws.purge_quarantine()
    assert removed == 2
    assert not (ws.path / "raw" / "secret.txt").exists()
    assert (ws.path / "outputs" / "keep.txt").exists()
    assert (ws.path / "raw").is_dir(), "directories stay, contents go"
