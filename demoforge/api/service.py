"""Local teaser use cases; SQLite and manifests remain authoritative."""

import json
import re
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import httpx

from demoforge.ingest.github import GitHubSource, parse_repository
from demoforge.pack.workspace import RunWorkspace, WorkspaceConfig
from demoforge.schemas.approval import Approval
from demoforge.workflow.controller import ApprovalRequired, RunCancelled, RunFailed
from demoforge.workflow.state import TERMINAL_STATES, StateStore
from demoforge.workflow.teaser_pipeline import teaser_controller


def acquire_source(url):
    with httpx.Client(trust_env=False) as client:
        return GitHubSource(client).acquire(url)


def prepare_source(catalog):
    from demoforge.teaser.prepare import prepare_teaser

    return prepare_teaser(catalog)


def validate_source(spec, catalog):
    from demoforge.teaser.prepare import validate_teaser

    return validate_teaser(spec, catalog)


def render_source(spec, target):
    from demoforge.teaser.render import render_teaser

    return render_teaser(spec, target)


@dataclass(frozen=True)
class TeaserDependencies:
    source: Callable = acquire_source
    prepare: Callable = prepare_source
    validate: Callable = validate_source
    render: Callable = render_source


class TeaserService:
    def __init__(self, config: WorkspaceConfig, dependencies: TeaserDependencies | None = None):
        self.config = config
        self.dependencies = dependencies or TeaserDependencies()
        from demoforge.api.recorded_service import RecordedDemoService

        self.recorded_demo = RecordedDemoService(self.config.root)

    @contextmanager
    def session(self, run_id=None):
        if run_id is not None and not re.fullmatch(r"teaser-[a-f0-9]{32}", run_id):
            raise ValueError("invalid run ID")
        store = StateStore.open(self.config.state_db)
        try:
            if run_id is not None:
                store.get_run(run_id)
                if store.get_options(run_id).get("mode") != "teaser":
                    raise ValueError("not a teaser run")
            yield store
        finally:
            store.close()

    def create(self, repository_url, request_id=None):
        parse_repository(repository_url)
        if request_id is not None and not re.fullmatch(r"[a-f0-9]{32}", request_id):
            raise ValueError("invalid request ID")
        run_id = f"teaser-{request_id or uuid4().hex}"
        with self.session() as store:
            exists = store.connection.execute(
                "SELECT 1 FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
            if exists:
                if store.get_options(run_id).get("repository_url") != repository_url:
                    raise ValueError("request ID already used for another repository")
            else:
                teaser_controller(store, self.config, self.dependencies).create(
                    run_id,
                    options={
                        "mode": "teaser",
                        "repository_url": repository_url,
                    },
                )
        return self.get(run_id)

    def advance(self, run_id):
        with self.session(run_id) as store:
            try:
                teaser_controller(store, self.config, self.dependencies).resume(run_id)
            except (ApprovalRequired, RunCancelled, RunFailed):
                pass
        return self.get(run_id)

    def cancel(self, run_id):
        with self.session(run_id) as store:
            if store.get_run(run_id).state in TERMINAL_STATES:
                raise ValueError("run is already finished")
            store.request_cancellation(run_id)
        return self.advance(run_id)

    def approve(self, run_id, subject, *, actor, note, reviewed):
        if reviewed is not True or not actor.strip() or not note.strip():
            raise ValueError("explicit review, operator name and review note required")
        with self.session(run_id) as store:
            run = store.get_run(run_id)
            pending = run.checkpoint or {}
            keys = ("subject_type", "subject_id", "subject_revision", "subject_sha256")
            if run.state != "awaiting_approval" or any(
                subject.get(key) != pending.get(key) for key in keys
            ):
                raise ValueError("pending approval mismatch; refresh and review again")
            stage, identity = (
                ("teaser-storyboard", "storyboard")
                if pending["subject_type"] == "storyboard"
                else ("teaser-render", "video")
            )
            ref = self._ref(store, run_id, stage, identity)
            if ref.sha256 != pending["subject_sha256"]:
                raise ValueError("approval artifact mismatch")
            if store.approvals_for(run_id, pending["subject_type"], pending["subject_id"]):
                raise ValueError("approval already recorded; continue the run")
            store.record_approval(
                Approval(
                    schema_version=1,
                    approval_id=f"approval-{uuid4().hex}",
                    run_id=run_id,
                    **{key: pending[key] for key in keys},
                    actor_id=actor,
                    decision="approved",
                    decided_at=store.now(),
                    note=note,
                )
            )
        return self.get(run_id)

    def _ref(self, store, run_id, stage, identity):
        manifest = store.latest_manifest(run_id, stage)
        ref = (
            next((item for item in manifest.outputs if item.artifact_id == identity), None)
            if manifest
            else None
        )
        if ref is None:
            raise ValueError("artifact not available")
        workspace = RunWorkspace.create(self.config, run_id)
        if workspace.verify(ref):
            raise ValueError("artifact integrity failure; do not use this output")
        return ref

    def get(self, run_id):
        with self.session(run_id) as store:
            run = store.get_run(run_id)
            result = {
                "run_id": run_id,
                "state": run.state,
                "stage": run.current_stage,
                "checkpoint": run.checkpoint,
                "created_at": run.created_at.isoformat(),
                "repository_url": store.get_options(run_id)["repository_url"],
                "storyboard": None,
                "catalog": None,
                "preview_url": None,
                "downloads": {},
                "approved": False,
                "error": None,
            }
            if run.checkpoint:
                pending = run.checkpoint
                result["approved"] = any(
                    decision.decision == "approved"
                    and decision.subject_sha256 == pending["subject_sha256"]
                    and decision.subject_revision == pending["subject_revision"]
                    for decision in store.approvals_for(
                        run_id, pending["subject_type"], pending["subject_id"]
                    )
                )
            workspace = RunWorkspace.create(self.config, run_id)
            for stage, identity in [
                ("teaser-source", "catalog"),
                ("teaser-storyboard", "storyboard"),
            ]:
                if store.latest_manifest(run_id, stage):
                    ref = self._ref(store, run_id, stage, identity)
                    result[identity] = json.loads(workspace.resolve(ref.path).read_bytes())
            if store.latest_manifest(run_id, "teaser-render"):
                self._ref(store, run_id, "teaser-render", "video")
                result["preview_url"] = f"/api/runs/{run_id}/artifacts/preview"
            if run.state == "complete":
                result["downloads"] = {
                    identity: f"/api/runs/{run_id}/artifacts/{identity}"
                    for identity in ("video", "evidence", "review", "bundle")
                }
            if run.state == "failed":
                messages = {
                    "teaser-source": (
                        "Repository acquisition failed. Check the public GitHub URL, "
                        "network and rate limits."
                    ),
                    "teaser-storyboard": (
                        "No safe source-linked teaser could be prepared. The README needs "
                        "two distinct clean product excerpts of 2 or more words, each at most "
                        "60 characters. Add short sentences, then start a new run."
                    ),
                    "teaser-render": (
                        "Rendering failed. Check the local Playwright rig and FFmpeg installation."
                    ),
                }
                result["error"] = messages.get(run.current_stage, "Output verification failed.")
            return result

    def list_runs(self):
        with self.session() as store:
            ids = [
                row[0]
                for row in store.connection.execute(
                    "SELECT run_id FROM runs WHERE run_id LIKE 'teaser-%' "
                    "ORDER BY created_at DESC LIMIT 50"
                )
            ]
        return [self.get(run_id) for run_id in ids]

    def recover(self):
        with self.session() as store:
            attempts = store.connection.execute(
                "SELECT attempt_id FROM attempts WHERE state = 'running' "
                "AND run_id LIKE 'teaser-%' AND stage_id LIKE 'teaser-%'"
            ).fetchall()
            for (attempt_id,) in attempts:
                store.finish_attempt(
                    attempt_id,
                    "failed",
                    manifest=None,
                    error="interrupted: local server exited mid-attempt",
                )

    def artifact(self, run_id: str, identity: str) -> tuple[Path, object]:
        with self.session(run_id) as store:
            if identity == "preview":
                stage, name = "teaser-render", "video"
            elif identity in {"video", "evidence", "review", "bundle"}:
                if store.get_run(run_id).state != "complete":
                    raise ValueError("final output approval required before download")
                stage, name = "teaser-export", identity
            else:
                raise ValueError("unknown declared artifact")
            ref = self._ref(store, run_id, stage, name)
            return RunWorkspace.create(self.config, run_id).resolve(ref.path), ref
