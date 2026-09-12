"""Recovery, snapshot export/import and terminal cleanup for runs.

The SQLite store is authoritative; a snapshot is a JSON copy used for backups, bug reports and
moving a run between machines. Importing never overwrites an existing run.
"""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from demoforge.pack.workspace import RunWorkspace
from demoforge.schemas import Approval, ArtifactManifest
from demoforge.workflow.state import TERMINAL_STATES, StateStore

SNAPSHOT_VERSION = 1
INTERRUPTED_ERROR = "interrupted: process exited mid-attempt"
DEFAULT_RETENTION = timedelta(days=30)


def recover_stale_attempts(store: StateStore) -> list[str]:
    """Mark every attempt still ``running`` as failed. Call once at process start.

    A single-process controller cannot have a genuinely running attempt at startup, so any such
    row is a crash leftover. Runs stay resumable; the next attempt gets the next number.
    """
    rows = store.connection.execute(
        "SELECT attempt_id FROM attempts WHERE state = 'running' ORDER BY started_at"
    ).fetchall()
    recovered: list[str] = []
    for (attempt_id,) in rows:
        store.finish_attempt(attempt_id, "failed", manifest=None, error=INTERRUPTED_ERROR)
        recovered.append(attempt_id)
    return recovered


def export_snapshot(store: StateStore, run_id: str) -> dict[str, Any]:
    """Serialize one run (record, attempts, manifests, approvals, events) to plain JSON data."""
    run = store.get_run(run_id)
    conn = store.connection
    attempts = conn.execute(
        "SELECT attempt_id, stage_id, number, state, idempotency_key, started_at, finished_at,"
        " manifest_id, error FROM attempts WHERE run_id = ? ORDER BY started_at, number",
        (run_id,),
    ).fetchall()
    manifests = conn.execute(
        "SELECT manifest_id, created_at, body FROM manifests WHERE run_id = ? ORDER BY created_at",
        (run_id,),
    ).fetchall()
    approvals = conn.execute(
        "SELECT body FROM approvals WHERE run_id = ? ORDER BY approval_id", (run_id,)
    ).fetchall()
    return {
        "schema_version": SNAPSHOT_VERSION,
        "run": {
            "run_id": run.run_id,
            "created_at": run.created_at.isoformat(),
            "updated_at": run.updated_at.isoformat(),
            "state": run.state,
            "current_stage": run.current_stage,
            "checkpoint": run.checkpoint,
            "input_manifest_id": run.input_manifest_id,
            "cancellation_requested": run.cancellation_requested,
            "retention_deadline": (
                run.retention_deadline.isoformat() if run.retention_deadline else None
            ),
        },
        "attempts": [
            {
                "attempt_id": r[0],
                "stage_id": r[1],
                "number": r[2],
                "state": r[3],
                "idempotency_key": r[4],
                "started_at": r[5],
                "finished_at": r[6],
                "manifest_id": r[7],
                "error": r[8],
            }
            for r in attempts
        ],
        "manifests": [
            {"manifest_id": m[0], "created_at": m[1], "body": json.loads(m[2])} for m in manifests
        ],
        "approvals": [json.loads(a[0]) for a in approvals],
        "events": store.events(run_id),
    }


def import_snapshot(store: StateStore, snapshot: dict[str, Any]) -> str:
    """Load a snapshot into an empty slot. Validates bodies through the schemas before writing."""
    if snapshot.get("schema_version") != SNAPSHOT_VERSION:
        raise ValueError(f"unsupported snapshot schema_version: {snapshot.get('schema_version')!r}")
    run = snapshot["run"]
    run_id = run["run_id"]
    conn = store.connection
    if conn.execute("SELECT 1 FROM runs WHERE run_id = ?", (run_id,)).fetchone():
        raise ValueError(f"run {run_id} already exists; snapshots never overwrite")
    # Validate every typed body before touching the database.
    manifests = [ArtifactManifest.model_validate(m["body"]) for m in snapshot.get("manifests", [])]
    approvals = [Approval.model_validate(a) for a in snapshot.get("approvals", [])]
    if any(m.run_id != run_id for m in manifests) or any(a.run_id != run_id for a in approvals):
        raise ValueError("snapshot contains records for a different run")

    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO runs(run_id, created_at, updated_at, state, current_stage, checkpoint,"
            " input_manifest_id, cancellation_requested, retention_deadline)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                run_id,
                run["created_at"],
                run["updated_at"],
                run["state"],
                run["current_stage"],
                json.dumps(run["checkpoint"]) if run["checkpoint"] else None,
                run["input_manifest_id"],
                1 if run["cancellation_requested"] else 0,
                run["retention_deadline"],
            ),
        )
        for a in snapshot.get("attempts", []):
            conn.execute(
                "INSERT INTO attempts(attempt_id, run_id, stage_id, number, state,"
                " idempotency_key, started_at, finished_at, manifest_id, error)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    a["attempt_id"],
                    run_id,
                    a["stage_id"],
                    a["number"],
                    a["state"],
                    a["idempotency_key"],
                    a["started_at"],
                    a["finished_at"],
                    a["manifest_id"],
                    a["error"],
                ),
            )
        for raw, m in zip(snapshot.get("manifests", []), manifests, strict=True):
            conn.execute(
                "INSERT INTO manifests(manifest_id, run_id, stage_id, attempt_id, created_at, body)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    m.manifest_id,
                    run_id,
                    m.stage_id,
                    m.attempt_id,
                    raw["created_at"],
                    m.model_dump_json(),
                ),
            )
        for a in approvals:
            conn.execute(
                "INSERT INTO approvals(approval_id, run_id, subject_type, subject_id,"
                " subject_revision, subject_sha256, decision, body)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    a.approval_id,
                    run_id,
                    a.subject_type,
                    a.subject_id,
                    a.subject_revision,
                    a.subject_sha256,
                    a.decision,
                    a.model_dump_json(),
                ),
            )
        for e in snapshot.get("events", []):
            conn.execute(
                "INSERT INTO events(run_id, at, stage_id, attempt_id, event, details)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    run_id,
                    e["at"],
                    e["stage_id"],
                    e["attempt_id"],
                    e["event"],
                    json.dumps(e["details"]) if e["details"] else None,
                ),
            )
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    return run_id


def finalize_run(
    store: StateStore,
    workspace: RunWorkspace,
    final_state: str,
    *,
    retention: timedelta = DEFAULT_RETENTION,
) -> None:
    """Move a run to a terminal state, purge quarantine and set the retention deadline.

    Published outputs are kept; ``raw``/``staging`` are deleted whatever the outcome, so a failed
    or cancelled run never leaves cloned repositories or unreviewed footage on disk.
    """
    if final_state not in TERMINAL_STATES:
        raise ValueError(f"{final_state!r} is not a terminal state")
    store.transition(workspace.run_id, final_state)  # type: ignore[arg-type]
    workspace.sweep_temp_files()
    workspace.purge_quarantine()
    store.set_retention_deadline(workspace.run_id, store.now() + retention)
