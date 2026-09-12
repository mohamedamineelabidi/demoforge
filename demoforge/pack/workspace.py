"""Run workspace: the per-run data lake with path-escape protection and atomic publication.

Layout: ``<root>/runs/<run_id>/{raw,staging,curated,outputs}``. ``raw`` and ``staging`` are
quarantine (purgeable); ``curated`` and ``outputs`` hold published artifacts referenced by
manifests. The root must live outside synced folders (OneDrive) so SQLite and media are not
fought over by a sync client.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from demoforge.schemas import ArtifactRef
from demoforge.schemas._base import validate_relative_path

LAKE_DIRS = ("raw", "staging", "curated", "outputs")
QUARANTINE_DIRS = ("raw", "staging")
_RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class PathEscapeError(ValueError):
    """A path resolved outside its run workspace (traversal, absolute path or symlink)."""


def resolve_workspace_root() -> Path:
    """``DEMOFORGE_WORKSPACE`` if set, else a per-user local data dir. Never inside OneDrive."""
    env = os.environ.get("DEMOFORGE_WORKSPACE")
    if env:
        root = Path(env).expanduser().resolve()
    else:
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME")
        root = (Path(base) if base else Path.home() / ".local" / "share").resolve() / "demoforge"
    if "onedrive" in str(root).lower():
        raise ValueError(f"workspace root must not be inside OneDrive: {root}")
    return root


@dataclass(frozen=True)
class WorkspaceConfig:
    root: Path

    @classmethod
    def from_env(cls) -> WorkspaceConfig:
        return cls(root=resolve_workspace_root())

    @property
    def state_db(self) -> Path:
        return self.root / "state.sqlite"


@dataclass(frozen=True)
class RunWorkspace:
    run_id: str
    path: Path

    @classmethod
    def create(cls, config: WorkspaceConfig, run_id: str) -> RunWorkspace:
        if not _RUN_ID.match(run_id):
            raise ValueError(f"unsafe run_id: {run_id!r}")
        path = (config.root / "runs" / run_id).resolve()
        for sub in LAKE_DIRS:
            (path / sub).mkdir(parents=True, exist_ok=True)
        return cls(run_id=run_id, path=path)

    def resolve(self, relative: str) -> Path:
        """Map a run-relative path to disk, refusing anything that escapes the run directory."""
        try:
            validate_relative_path(relative)
        except ValueError as exc:
            raise PathEscapeError(str(exc)) from exc
        candidate = self.path / relative
        # Resolve the deepest existing ancestor so symlinks anywhere on the path are followed.
        probe = candidate
        while not probe.exists() and probe != probe.parent:
            probe = probe.parent
        real_probe = probe.resolve()
        if real_probe != self.path and self.path not in real_probe.parents:
            raise PathEscapeError(f"{relative} escapes the run workspace")
        return candidate

    def publish_bytes(
        self, relative: str, data: bytes, *, media_type: str, artifact_id: str
    ) -> ArtifactRef:
        """Write atomically (temp file + replace) and return a hashed reference."""
        target = self.resolve(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=".publish-", suffix=".tmp", dir=target.parent)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_name, target)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        return ArtifactRef(
            artifact_id=artifact_id,
            path=relative,
            sha256=hashlib.sha256(data).hexdigest(),
            media_type=media_type,
            size_bytes=len(data),
        )

    def publish_file(
        self, relative: str, source: Path, *, media_type: str, artifact_id: str
    ) -> ArtifactRef:
        """Move an already-written file into place atomically (large media rendered elsewhere)."""
        target = self.resolve(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = _hash_file(source)
        size = source.stat().st_size
        os.replace(source, target)
        return ArtifactRef(
            artifact_id=artifact_id,
            path=relative,
            sha256=digest,
            media_type=media_type,
            size_bytes=size,
        )

    def verify(self, ref: ArtifactRef) -> list[str]:
        """Integrity check for one artifact; empty means present with matching size and hash."""
        try:
            target = self.resolve(ref.path)
        except PathEscapeError as exc:
            return [f"{ref.artifact_id}: {exc}"]
        if not target.is_file():
            return [f"{ref.artifact_id}: missing file {ref.path}"]
        errors: list[str] = []
        size = target.stat().st_size
        if size != ref.size_bytes:
            errors.append(f"{ref.artifact_id}: size {size} != {ref.size_bytes}")
        digest = _hash_file(target)
        if digest != ref.sha256:
            errors.append(f"{ref.artifact_id}: sha256 mismatch")
        return errors

    def purge_quarantine(self) -> int:
        """Delete raw/staging contents (retention policy), keep the directories; return count."""
        removed = 0
        for sub in QUARANTINE_DIRS:
            folder = self.path / sub
            for entry in folder.iterdir():
                if entry.is_dir() and not entry.is_symlink():
                    shutil.rmtree(entry)
                else:
                    entry.unlink()
                removed += 1
        return removed

    def sweep_temp_files(self) -> int:
        """Remove ``.publish-*.tmp`` leftovers from interrupted publishes; return count."""
        removed = 0
        for stray in self.path.rglob(".publish-*.tmp"):
            stray.unlink(missing_ok=True)
            removed += 1
        return removed


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()
