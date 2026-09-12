"""SQLite-backed authoritative state: runs, attempts, manifests, approvals and diagnostic events.

The database is the single source of truth. JSON exports and events are snapshots. All writes
happen in short transactions; the controller (TASK-070) decides *when* to call these methods,
this module decides *whether* the requested change is legal.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from demoforge.schemas import Approval, ArtifactManifest, approval_matches

RunState = Literal[
    "pending",
    "ingesting",
    "planning",
    "awaiting_approval",
    "acquiring_footage",
    "storyboarding",
    "rendering",
    "reviewing",
    "complete",
    "failed",
    "cancelled",
]
AttemptState = Literal["pending", "running", "awaiting_approval", "complete", "failed", "cancelled"]

TERMINAL_STATES: frozenset[str] = frozenset({"complete", "failed", "cancelled"})

# Legal forward moves. Every non-terminal state may also go to failed or cancelled.
_FORWARD: dict[str, frozenset[str]] = {
    "pending": frozenset({"ingesting"}),
    "ingesting": frozenset({"planning"}),
    "planning": frozenset({"awaiting_approval", "acquiring_footage"}),
    "awaiting_approval": frozenset(
        {"planning", "acquiring_footage", "storyboarding", "rendering", "reviewing", "complete"}
    ),
    "acquiring_footage": frozenset({"storyboarding", "awaiting_approval"}),
    "storyboarding": frozenset({"awaiting_approval", "rendering"}),
    "rendering": frozenset({"reviewing"}),
    "reviewing": frozenset({"awaiting_approval", "complete", "storyboarding"}),
}


def legal_transitions(state: str) -> frozenset[str]:
    if state in TERMINAL_STATES:
        return frozenset()
    return _FORWARD[state] | {"failed", "cancelled"}


class StateError(RuntimeError):
    """Base class for state-store errors."""


class UnknownRunError(StateError):
    pass


class IllegalTransitionError(StateError):
    pass


class ConcurrencyError(StateError):
    """Duplicate run, second running attempt for a stage, or an approval rewrite."""


@dataclass(frozen=True)
class RunRecord:
    schema_version: int
    run_id: str
    created_at: datetime
    updated_at: datetime
    state: str
    current_stage: str | None
    checkpoint: dict[str, Any] | None
    input_manifest_id: str | None
    cancellation_requested: bool
    retention_deadline: datetime | None


@dataclass(frozen=True)
class AttemptRecord:
    attempt_id: str
    run_id: str
    stage_id: str
    number: int
    state: str
    idempotency_key: str
    started_at: datetime
    finished_at: datetime | None
    manifest_id: str | None
    error: str | None


class _SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    state TEXT NOT NULL,
    current_stage TEXT,
    checkpoint TEXT,
    input_manifest_id TEXT,
    cancellation_requested INTEGER NOT NULL DEFAULT 0,
    retention_deadline TEXT,
    options TEXT
);
CREATE TABLE IF NOT EXISTS attempts (
    attempt_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    stage_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    state TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    manifest_id TEXT,
    error TEXT,
    superseded INTEGER NOT NULL DEFAULT 0,
    UNIQUE (run_id, stage_id, number)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_attempt
    ON attempts(run_id, stage_id) WHERE state = 'running';
CREATE TABLE IF NOT EXISTS manifests (
    manifest_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    stage_id TEXT NOT NULL,
    attempt_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
    approval_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    subject_revision INTEGER NOT NULL,
    subject_sha256 TEXT NOT NULL,
    decision TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    at TEXT NOT NULL,
    stage_id TEXT,
    attempt_id TEXT,
    event TEXT NOT NULL,
    details TEXT
);
"""


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat()


def _parse(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


class StateStore:
    def __init__(self, conn: sqlite3.Connection, clock: Any) -> None:
        self._conn = conn
        self._clock = clock

    @classmethod
    def open(cls, path: Path, *, clock: Any | None = None) -> StateStore:
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path), isolation_level=None)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.executescript(_SCHEMA)
        return cls(conn, clock or _SystemClock())

    def close(self) -> None:
        self._conn.close()

    @property
    def connection(self) -> sqlite3.Connection:
        """Read access for recovery/snapshot helpers in this package. Not a public write API."""
        return self._conn

    def now(self) -> datetime:
        return self._clock.now()

    def set_retention_deadline(self, run_id: str, deadline: datetime) -> None:
        self.get_run(run_id)
        with self._tx():
            self._conn.execute(
                "UPDATE runs SET retention_deadline = ?, updated_at = ? WHERE run_id = ?",
                (_iso(deadline), _iso(self._clock.now()), run_id),
            )

    # -- runs -----------------------------------------------------------------------------------

    def create_run(self, run_id: str, *, input_manifest_id: str | None) -> RunRecord:
        now = _iso(self._clock.now())
        try:
            with self._tx():
                self._conn.execute(
                    "INSERT INTO runs(run_id, created_at, updated_at, state, input_manifest_id)"
                    " VALUES (?, ?, ?, 'pending', ?)",
                    (run_id, now, now, input_manifest_id),
                )
                self._event(
                    run_id, "run_created", None, None, {"input_manifest_id": input_manifest_id}
                )
        except sqlite3.IntegrityError as exc:
            raise ConcurrencyError(f"run {run_id} already exists") from exc
        return self.get_run(run_id)

    def get_run(self, run_id: str) -> RunRecord:
        row = self._conn.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            raise UnknownRunError(run_id)
        cols = [c[0] for c in self._conn.execute("SELECT * FROM runs LIMIT 0").description]
        data = dict(zip(cols, row, strict=True))
        return RunRecord(
            schema_version=1,
            run_id=data["run_id"],
            created_at=_parse(data["created_at"]),  # type: ignore[arg-type]
            updated_at=_parse(data["updated_at"]),  # type: ignore[arg-type]
            state=data["state"],
            current_stage=data["current_stage"],
            checkpoint=json.loads(data["checkpoint"]) if data["checkpoint"] else None,
            input_manifest_id=data["input_manifest_id"],
            cancellation_requested=bool(data["cancellation_requested"]),
            retention_deadline=_parse(data["retention_deadline"]),
        )

    def transition(
        self,
        run_id: str,
        new_state: RunState,
        *,
        current_stage: str | None = None,
        checkpoint: dict[str, Any] | None = None,
    ) -> RunRecord:
        run = self.get_run(run_id)
        if new_state not in legal_transitions(run.state):
            raise IllegalTransitionError(
                f"{run.state} -> {new_state} is not allowed for run {run_id}"
            )
        now = _iso(self._clock.now())
        with self._tx():
            self._conn.execute(
                "UPDATE runs SET state = ?, updated_at = ?,"
                " current_stage = COALESCE(?, current_stage),"
                " checkpoint = ? WHERE run_id = ?",
                (
                    new_state,
                    now,
                    current_stage,
                    json.dumps(checkpoint) if checkpoint else None,
                    run_id,
                ),
            )
            self._event(
                run_id, "transition", current_stage, None, {"from": run.state, "to": new_state}
            )
        return self.get_run(run_id)

    def request_cancellation(self, run_id: str) -> None:
        self.get_run(run_id)
        with self._tx():
            self._conn.execute(
                "UPDATE runs SET cancellation_requested = 1, updated_at = ? WHERE run_id = ?",
                (_iso(self._clock.now()), run_id),
            )
            self._event(run_id, "cancellation_requested", None, None, None)

    def reopen_run(self, run_id: str, state: RunState, *, current_stage: str) -> RunRecord:
        """Jump a non-terminal run back to an earlier stage state after invalidation.

        Bypasses the forward-transition table on purpose: invalidation is the one legal backward
        move, and it is recorded as its own event.
        """
        run = self.get_run(run_id)
        if run.state in ("failed", "cancelled"):
            raise IllegalTransitionError(f"run {run_id} is terminal ({run.state})")
        # ``complete`` may be reopened: editing a caption on a finished video is the main use
        # case for invalidation. Failed/cancelled runs need a new run instead.
        with self._tx():
            self._conn.execute(
                "UPDATE runs SET state = ?, current_stage = ?, checkpoint = NULL, updated_at = ?"
                " WHERE run_id = ?",
                (state, current_stage, _iso(self._clock.now()), run_id),
            )
            self._event(run_id, "reopened", current_stage, None, {"from": run.state, "to": state})
        return self.get_run(run_id)

    def set_options(self, run_id: str, options: dict[str, Any]) -> None:
        self.get_run(run_id)
        with self._tx():
            self._conn.execute(
                "UPDATE runs SET options = ? WHERE run_id = ?", (json.dumps(options), run_id)
            )

    def get_options(self, run_id: str) -> dict[str, Any]:
        row = self._conn.execute("SELECT options FROM runs WHERE run_id = ?", (run_id,)).fetchone()
        if row is None:
            raise UnknownRunError(run_id)
        return json.loads(row[0]) if row[0] else {}

    # -- attempts -------------------------------------------------------------------------------

    def begin_attempt(self, run_id: str, stage_id: str, *, idempotency_key: str) -> AttemptRecord:
        self.get_run(run_id)
        attempt_id = f"att_{uuid.uuid4().hex[:12]}"
        now = _iso(self._clock.now())
        try:
            with self._tx():
                number = self.attempt_count(run_id, stage_id) + 1
                self._conn.execute(
                    "INSERT INTO attempts(attempt_id, run_id, stage_id, number, state,"
                    " idempotency_key, started_at) VALUES (?, ?, ?, ?, 'running', ?, ?)",
                    (attempt_id, run_id, stage_id, number, idempotency_key, now),
                )
                self._event(run_id, "attempt_started", stage_id, attempt_id, {"number": number})
        except sqlite3.IntegrityError as exc:
            raise ConcurrencyError(
                f"stage {stage_id} of {run_id} already has a running attempt"
            ) from exc
        return self.get_attempt(attempt_id)

    def finish_attempt(
        self,
        attempt_id: str,
        state: AttemptState,
        *,
        manifest: ArtifactManifest | None,
        error: str | None = None,
    ) -> AttemptRecord:
        attempt = self.get_attempt(attempt_id)
        if state in ("failed", "cancelled") and manifest is not None and manifest.outputs:
            raise ValueError("a failed or cancelled attempt cannot publish successful outputs")
        if manifest is not None and (
            manifest.attempt_id != attempt_id
            or manifest.run_id != attempt.run_id
            or manifest.stage_id != attempt.stage_id
        ):
            raise ValueError("manifest does not belong to this attempt")
        now = _iso(self._clock.now())
        with self._tx():
            if manifest is not None:
                self._conn.execute(
                    "INSERT INTO manifests(manifest_id, run_id, stage_id, attempt_id,"
                    " created_at, body) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        manifest.manifest_id,
                        manifest.run_id,
                        manifest.stage_id,
                        manifest.attempt_id,
                        now,
                        manifest.model_dump_json(),
                    ),
                )
            self._conn.execute(
                "UPDATE attempts SET state = ?, finished_at = ?, manifest_id = ?, error = ?"
                " WHERE attempt_id = ?",
                (state, now, manifest.manifest_id if manifest else None, error, attempt_id),
            )
            self._event(
                attempt.run_id,
                "attempt_finished",
                attempt.stage_id,
                attempt_id,
                {"state": state, "error": error},
            )
        return self.get_attempt(attempt_id)

    def get_attempt(self, attempt_id: str) -> AttemptRecord:
        row = self._conn.execute(
            "SELECT attempt_id, run_id, stage_id, number, state, idempotency_key, started_at,"
            " finished_at, manifest_id, error FROM attempts WHERE attempt_id = ?",
            (attempt_id,),
        ).fetchone()
        if row is None:
            raise StateError(f"unknown attempt {attempt_id}")
        return AttemptRecord(
            attempt_id=row[0],
            run_id=row[1],
            stage_id=row[2],
            number=row[3],
            state=row[4],
            idempotency_key=row[5],
            started_at=_parse(row[6]),  # type: ignore[arg-type]
            finished_at=_parse(row[7]),
            manifest_id=row[8],
            error=row[9],
        )

    def attempt_count(self, run_id: str, stage_id: str) -> int:
        (count,) = self._conn.execute(
            "SELECT COUNT(*) FROM attempts WHERE run_id = ? AND stage_id = ?", (run_id, stage_id)
        ).fetchone()
        return int(count)

    def active_attempt_count(self, run_id: str, stage_id: str) -> int:
        """Attempts that still count against the stage's budget (not superseded)."""
        (count,) = self._conn.execute(
            "SELECT COUNT(*) FROM attempts WHERE run_id = ? AND stage_id = ? AND superseded = 0",
            (run_id, stage_id),
        ).fetchone()
        return int(count)

    def supersede_stage(self, run_id: str, stage_id: str) -> int:
        """Retire every attempt of a stage; their manifests stop being 'latest' and budgets reset.

        History is kept: rows are flagged, never deleted.
        """
        with self._tx():
            cur = self._conn.execute(
                "UPDATE attempts SET superseded = 1 WHERE run_id = ? AND stage_id = ?"
                " AND superseded = 0 AND state != 'running'",
                (run_id, stage_id),
            )
            self._event(run_id, "stage_superseded", stage_id, None, {"attempts": cur.rowcount})
        return cur.rowcount

    # -- manifests ------------------------------------------------------------------------------

    def get_manifest(self, manifest_id: str) -> ArtifactManifest:
        row = self._conn.execute(
            "SELECT body FROM manifests WHERE manifest_id = ?", (manifest_id,)
        ).fetchone()
        if row is None:
            raise StateError(f"unknown manifest {manifest_id}")
        return ArtifactManifest.model_validate_json(row[0])

    def latest_manifest(self, run_id: str, stage_id: str) -> ArtifactManifest | None:
        row = self._conn.execute(
            "SELECT m.body FROM manifests m JOIN attempts a ON a.manifest_id = m.manifest_id"
            " WHERE m.run_id = ? AND m.stage_id = ? AND a.state = 'complete' AND a.superseded = 0"
            " ORDER BY a.number DESC LIMIT 1",
            (run_id, stage_id),
        ).fetchone()
        return ArtifactManifest.model_validate_json(row[0]) if row else None

    # -- approvals ------------------------------------------------------------------------------

    def record_approval(self, approval: Approval) -> None:
        self.get_run(approval.run_id)
        try:
            with self._tx():
                self._conn.execute(
                    "INSERT INTO approvals(approval_id, run_id, subject_type, subject_id,"
                    " subject_revision, subject_sha256, decision, body)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        approval.approval_id,
                        approval.run_id,
                        approval.subject_type,
                        approval.subject_id,
                        approval.subject_revision,
                        approval.subject_sha256,
                        approval.decision,
                        approval.model_dump_json(),
                    ),
                )
                self._event(
                    approval.run_id,
                    "approval_recorded",
                    None,
                    None,
                    {
                        "subject_type": approval.subject_type,
                        "subject_id": approval.subject_id,
                        "revision": approval.subject_revision,
                        "decision": approval.decision,
                    },
                )
        except sqlite3.IntegrityError as exc:
            raise ConcurrencyError(
                f"approval {approval.approval_id} already recorded; approvals are immutable"
            ) from exc

    def approvals_for(self, run_id: str, subject_type: str, subject_id: str) -> list[Approval]:
        rows = self._conn.execute(
            "SELECT body FROM approvals WHERE run_id = ? AND subject_type = ? AND subject_id = ?",
            (run_id, subject_type, subject_id),
        ).fetchall()
        return [Approval.model_validate_json(r[0]) for r in rows]

    def has_approval(
        self, run_id: str, subject_type: str, subject_id: str, revision: int, sha256: str
    ) -> bool:
        return any(
            approval_matches(a, subject_type, subject_id, revision, sha256)  # type: ignore[arg-type]
            for a in self.approvals_for(run_id, subject_type, subject_id)
        )

    # -- events (diagnostics only) --------------------------------------------------------------

    def events(self, run_id: str) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT at, stage_id, attempt_id, event, details FROM events"
            " WHERE run_id = ? ORDER BY id",
            (run_id,),
        ).fetchall()
        return [
            {
                "at": r[0],
                "stage_id": r[1],
                "attempt_id": r[2],
                "event": r[3],
                "details": json.loads(r[4]) if r[4] else None,
            }
            for r in rows
        ]

    def _event(
        self,
        run_id: str,
        event: str,
        stage_id: str | None,
        attempt_id: str | None,
        details: dict[str, Any] | None,
    ) -> None:
        self._conn.execute(
            "INSERT INTO events(run_id, at, stage_id, attempt_id, event, details)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                run_id,
                _iso(self._clock.now()),
                stage_id,
                attempt_id,
                event,
                json.dumps(details) if details else None,
            ),
        )

    # -- transactions ---------------------------------------------------------------------------

    def _tx(self) -> _Transaction:
        return _Transaction(self._conn)


class _Transaction:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def __enter__(self) -> None:
        self._conn.execute("BEGIN IMMEDIATE")

    def __exit__(self, exc_type: type | None, exc: BaseException | None, tb: object) -> None:
        if exc_type is None:
            self._conn.execute("COMMIT")
        else:
            self._conn.execute("ROLLBACK")


Clock = Callable[[], datetime]
