"""Explicit workflow controller.

One ordered list of stages, one SQLite store, one run at a time. ``resume`` walks the stages,
skipping those with a live manifest, runs the next one, and either continues, pauses for an
approval (persist checkpoint, raise ``ApprovalRequired``, exit) or ends the run.

Budgets: three attempts per stage for transient errors, one repair per stage for content errors.
Approvals bind to (subject_type, subject_id, revision, sha256); a changed subject needs a new one.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from demoforge.pack.workspace import RunWorkspace, WorkspaceConfig
from demoforge.schemas import ArtifactManifest, Cost
from demoforge.workflow.recovery import finalize_run
from demoforge.workflow.stages import (
    ContentError,
    Stage,
    StageContext,
    StageOutcome,
    StageRequest,
    TransientError,
)
from demoforge.workflow.state import TERMINAL_STATES, StateStore

TRANSIENT_BUDGET = 3
REPAIR_BUDGET = 1


class ApprovalRequired(Exception):
    """The run is paused. Record an Approval for this subject, then call resume again."""

    def __init__(self, run_id: str, subject_type: str, subject_id: str, revision: int, sha256: str):
        super().__init__(f"{run_id}: approval required for {subject_type} {subject_id}")
        self.run_id = run_id
        self.subject_type = subject_type
        self.subject_id = subject_id
        self.subject_revision = revision
        self.subject_sha256 = sha256


class RunFailed(Exception):
    pass


class RunCancelled(Exception):
    pass


class Controller:
    def __init__(self, store: StateStore, config: WorkspaceConfig, stages: list[Stage]) -> None:
        ids = [s.stage_id for s in stages]
        if len(set(ids)) != len(ids):
            raise ValueError("duplicate stage ids")
        self._store = store
        self._config = config
        self._stages = stages

    # -- public ------------------------------------------------------------------------------

    def create(self, run_id: str, *, options: dict[str, Any] | None = None) -> None:
        RunWorkspace.create(self._config, run_id)
        self._store.create_run(run_id, input_manifest_id=None)
        if options:
            self._store.set_options(run_id, options)

    def cancel(self, run_id: str) -> None:
        self._store.request_cancellation(run_id)

    def invalidate_from(self, run_id: str, stage_id: str) -> None:
        """Mark ``stage_id`` and everything after it as superseded (e.g. after a caption edit)."""
        ids = [s.stage_id for s in self._stages]
        if stage_id not in ids:
            raise ValueError(f"unknown stage {stage_id!r}")
        start = ids.index(stage_id)
        for stage in self._stages[start:]:
            self._store.supersede_stage(run_id, stage.stage_id)
        self._store.reopen_run(run_id, self._stages[start].run_state, current_stage=stage_id)

    def resume(self, run_id: str) -> None:
        run = self._store.get_run(run_id)
        if run.state in TERMINAL_STATES:
            raise RunFailed(f"run {run_id} is terminal ({run.state}); create a new run")
        workspace = RunWorkspace.create(self._config, run_id)
        self._check_cancel(run_id, workspace)

        if run.state == "awaiting_approval":
            self._check_pending_approval(run_id, run.checkpoint or {}, workspace)

        for index, stage in enumerate(self._stages):
            if self._store.latest_manifest(run_id, stage.stage_id) is not None:
                continue
            self._check_cancel(run_id, workspace)
            if self._store.get_run(run_id).state != stage.run_state:
                self._store.transition(run_id, stage.run_state, current_stage=stage.stage_id)  # type: ignore[arg-type]
            outcome = self._run_with_budgets(run_id, stage, workspace)
            if outcome.approval_subject is not None:
                subject_type, subject_id, revision, sha = outcome.approval_subject
                nxt = self._stages[index + 1].stage_id if index + 1 < len(self._stages) else None
                checkpoint = {
                    "subject_type": subject_type,
                    "subject_id": subject_id,
                    "subject_revision": revision,
                    "subject_sha256": sha,
                    "continue_with": nxt,
                }
                self._store.transition(run_id, "awaiting_approval", checkpoint=checkpoint)
                raise ApprovalRequired(run_id, subject_type, subject_id, revision, sha)

        self._check_cancel(run_id, workspace)
        finalize_run(self._store, workspace, "complete")

    # -- internals ---------------------------------------------------------------------------

    def _check_cancel(self, run_id: str, workspace: RunWorkspace) -> None:
        if self._store.get_run(run_id).cancellation_requested:
            finalize_run(self._store, workspace, "cancelled")
            raise RunCancelled(run_id)

    def _check_pending_approval(
        self, run_id: str, checkpoint: dict[str, Any], workspace: RunWorkspace
    ) -> None:
        subject_type = checkpoint["subject_type"]
        subject_id = checkpoint["subject_id"]
        revision = checkpoint["subject_revision"]
        sha = checkpoint["subject_sha256"]
        decisions = [
            a.decision
            for a in self._store.approvals_for(run_id, subject_type, subject_id)
            if a.subject_revision == revision and a.subject_sha256 == sha
        ]
        if "rejected" in decisions:
            finalize_run(self._store, workspace, "failed")
            raise RunFailed(f"{subject_type} {subject_id} was rejected")
        if "approved" not in decisions:
            raise ApprovalRequired(run_id, subject_type, subject_id, revision, sha)
        # Approved: fall through; the loop continues with the next stage without a manifest.

    def _run_with_budgets(self, run_id: str, stage: Stage, workspace: RunWorkspace) -> StageOutcome:
        repairs_used = 0
        repair_hint: str | None = None
        while True:
            active = self._store.active_attempt_count(run_id, stage.stage_id)
            if active >= TRANSIENT_BUDGET:
                finalize_run(self._store, workspace, "failed")
                raise RunFailed(f"stage {stage.stage_id}: transient budget exhausted")
            request = self._request(run_id, stage, repair_hint)
            attempt = self._store.begin_attempt(
                run_id, stage.stage_id, idempotency_key=request.idempotency_key
            )
            request = StageRequest(**{**request.__dict__, "attempt_id": attempt.attempt_id})
            ctx = StageContext(
                workspace=workspace,
                now=self._store.now,
                cancelled=lambda: self._store.get_run(run_id).cancellation_requested,
            )
            try:
                outcome = stage.run(request, ctx)
            except TransientError as exc:
                self._store.finish_attempt(
                    attempt.attempt_id, "failed", manifest=None, error=f"transient: {exc}"
                )
                continue
            except ContentError as exc:
                self._store.finish_attempt(
                    attempt.attempt_id, "failed", manifest=None, error=f"content: {exc}"
                )
                if repairs_used >= REPAIR_BUDGET:
                    finalize_run(self._store, workspace, "failed")
                    raise RunFailed(f"stage {stage.stage_id}: repair budget exhausted") from exc
                repairs_used += 1
                repair_hint = str(exc)
                continue
            except Exception as exc:
                self._store.finish_attempt(
                    attempt.attempt_id,
                    "failed",
                    manifest=None,
                    error=f"error: {type(exc).__name__}",
                )
                finalize_run(self._store, workspace, "failed")
                raise RunFailed(f"stage {stage.stage_id}: {type(exc).__name__}") from exc

            errors = [e for ref in outcome.outputs for e in workspace.verify(ref)]
            if errors:
                self._store.finish_attempt(
                    attempt.attempt_id, "failed", manifest=None, error="; ".join(errors)
                )
                finalize_run(self._store, workspace, "failed")
                raise RunFailed(f"stage {stage.stage_id}: output integrity: {errors[0]}")

            manifest = self._manifest(request, outcome)
            self._store.finish_attempt(attempt.attempt_id, "complete", manifest=manifest)
            return outcome

    def _request(self, run_id: str, stage: Stage, repair_hint: str | None) -> StageRequest:
        inputs = self._input_manifests(run_id, stage)
        options = self._store.get_options(run_id)
        key_src = json.dumps(
            {
                "run": run_id,
                "stage": stage.stage_id,
                "inputs": [m.manifest_id for m in inputs],
                "options": options,
            },
            sort_keys=True,
        )
        return StageRequest(
            schema_version=1,
            run_id=run_id,
            stage_id=stage.stage_id,
            attempt_id="pending",
            input_manifest_ids=[m.manifest_id for m in inputs],
            options=options,
            idempotency_key=hashlib.sha256(key_src.encode()).hexdigest(),
            repair_hint=repair_hint,
        )

    def _input_manifests(self, run_id: str, stage: Stage) -> list[ArtifactManifest]:
        out: list[ArtifactManifest] = []
        for prev in self._stages:
            if prev.stage_id == stage.stage_id:
                break
            m = self._store.latest_manifest(run_id, prev.stage_id)
            if m is not None:
                out.append(m)
        return out

    def _manifest(self, request: StageRequest, outcome: StageOutcome) -> ArtifactManifest:
        inputs = [self._store.get_manifest(i) for i in request.input_manifest_ids]
        return ArtifactManifest(
            schema_version=1,
            manifest_id=f"man_{request.attempt_id}",
            run_id=request.run_id,
            stage_id=request.stage_id,
            attempt_id=request.attempt_id,
            revision=self._store.active_attempt_count(request.run_id, request.stage_id),
            created_at=self._store.now(),
            input_manifest_ids=request.input_manifest_ids,
            input_hashes=[ref.sha256 for m in inputs for ref in m.outputs],
            options_hash=hashlib.sha256(
                json.dumps(request.options, sort_keys=True).encode()
            ).hexdigest(),
            tool_versions=outcome.tool_versions,
            schema_versions={"manifest": 1},
            template_version=None,
            model_id=outcome.model_id,
            prompt_hash=outcome.prompt_hash,
            outputs=outcome.outputs,
            gate="pass",
            cost=Cost(currency="USD", model=None, compute=None, storage=None, total=None),
        )
