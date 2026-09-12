"""Command-line entry point. Sub-commands are added phase by phase (see TASKS.md)."""

import json
import os
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import httpx
import typer
from openai import OpenAI

from demoforge import PRODUCT_NAME, __version__
from demoforge.enrich.proposals import OpenAIAdapter
from demoforge.enrich.proposals import propose as generate_proposal
from demoforge.ingest.github import AcquisitionError, GitHubSource, parse_repository
from demoforge.pack.context_pack import assemble_context, publish_context
from demoforge.pack.workspace import RunWorkspace, WorkspaceConfig
from demoforge.schemas.approval import Approval
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.video.import_media import MediaPermission
from demoforge.workflow.controller import ApprovalRequired, RunCancelled, RunFailed
from demoforge.workflow.pipeline import pipeline_controller, read_json_file
from demoforge.workflow.state import StateError, StateStore

app = typer.Typer(
    help=f"{PRODUCT_NAME}: source-linked release-demo videos. Bounded ingestion available; "
    "Local supplied-footage rendering requires exact human approvals.",
    no_args_is_help=True,
)


@app.callback()
def main() -> None:
    """Keep the app a command group even while it has a single sub-command."""


@app.command()
def version() -> None:
    """Print the installed version."""
    typer.echo(f"{PRODUCT_NAME} {__version__}")


@app.command()
def ingest(repository: str, commit: str | None = typer.Option(None, "--commit")) -> None:
    """Acquire a bounded GitHub text snapshot and publish sanitized evidence JSON."""
    try:
        parse_repository(repository)
        config = WorkspaceConfig.from_env()
        with httpx.Client(trust_env=False) as client:
            snapshot = GitHubSource(client).acquire(repository, commit=commit)
        context = assemble_context(snapshot, now=datetime.now(UTC))
        workspace = RunWorkspace.create(config, f"ingest-{uuid4().hex}")
        artifacts = publish_context(context, workspace)
    except (AcquisitionError, ValueError) as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(1) from None
    except OSError:
        typer.echo("Workspace publication failed. Check local storage permissions.", err=True)
        raise typer.Exit(1) from None
    typer.echo(
        json.dumps(
            {
                "workspace": str(workspace.path),
                "commit": snapshot.commit_sha,
                "gate": context.report.gate,
                "evidence_count": len(context.catalog.evidence),
                "artifacts": [artifact.model_dump() for artifact in artifacts],
                "missing_inputs": context.report.missing_inputs,
            },
            indent=2,
        )
    )


def _resume(store: StateStore, config: WorkspaceConfig, run_id: str) -> None:
    try:
        pipeline_controller(store, config).resume(run_id)
        typer.echo(json.dumps({"run_id": run_id, "state": store.get_run(run_id).state}))
    except ApprovalRequired as need:
        typer.echo(
            json.dumps(
                {
                    "run_id": run_id,
                    "state": "awaiting_approval",
                    "subject_type": need.subject_type,
                    "subject_id": need.subject_id,
                    "subject_revision": need.subject_revision,
                    "subject_sha256": need.subject_sha256,
                    "workspace": str(config.root / "runs" / run_id),
                },
                indent=2,
            )
        )
    except RunCancelled:
        typer.echo(json.dumps({"run_id": run_id, "state": "cancelled"}))
    except (RunFailed, StateError):
        typer.echo("Run could not progress. Inspect its status and validated inputs.", err=True)
        raise typer.Exit(1) from None


@app.command("run")
def run_pipeline(
    catalog: Path,
    proposal: Path,
    footage: Path,
    actor: str = typer.Option(...),
    provenance: str = typer.Option(...),
    authorized: bool = typer.Option(False),
    privacy_reviewed: bool = typer.Option(False),
    sanitized_catalog: bool = typer.Option(False),
) -> None:
    """Start a supplied-footage run and stop at each exact-revision approval."""
    if not authorized or not privacy_reviewed or not sanitized_catalog:
        raise typer.BadParameter(
            "authorization, full privacy review and sanitized catalog required"
        )
    permission = MediaPermission(
        actor_id=actor,
        authorized=authorized,
        privacy_reviewed=privacy_reviewed,
        provenance=provenance,
    )
    config = WorkspaceConfig.from_env()
    store = StateStore.open(config.state_db)
    try:
        run_id = f"run-{uuid4().hex}"
        pipeline_controller(store, config).create(
            run_id,
            options={
                "catalog": str(catalog.resolve()),
                "proposal": str(proposal.resolve()),
                "footage": str(footage.resolve()),
                "permission": permission.model_dump(),
                "sanitized_catalog_confirmed": sanitized_catalog,
            },
        )
        _resume(store, config, run_id)
    finally:
        store.close()


@app.command()
def resume(run_id: str) -> None:
    """Resume an existing local run after recording an approval."""
    config = WorkspaceConfig.from_env()
    store = StateStore.open(config.state_db)
    try:
        _resume(store, config, run_id)
    finally:
        store.close()


@app.command()
def status(run_id: str) -> None:
    """Print authoritative local SQLite run state."""
    store = StateStore.open(WorkspaceConfig.from_env().state_db)
    try:
        typer.echo(json.dumps(asdict(store.get_run(run_id)), default=str, indent=2))
    except StateError:
        raise typer.BadParameter("unknown run") from None
    finally:
        store.close()


@app.command()
def approve(
    run_id: str,
    sha256: str = typer.Option(...),
    actor: str = typer.Option(...),
    note: str = typer.Option(...),
    reject: bool = typer.Option(False),
) -> None:
    """Record a reviewed pending subject; does not automatically resume execution."""
    store = StateStore.open(WorkspaceConfig.from_env().state_db)
    try:
        run = store.get_run(run_id)
        pending = run.checkpoint or {}
        if run.state != "awaiting_approval" or pending.get("subject_sha256") != sha256:
            raise typer.BadParameter("pending approval SHA-256 mismatch")
        if not actor.strip() or not note.strip():
            raise typer.BadParameter("operator identity and full review note required")
        store.record_approval(
            Approval(
                schema_version=1,
                approval_id=f"approval-{uuid4().hex}",
                run_id=run_id,
                subject_type=pending["subject_type"],
                subject_id=pending["subject_id"],
                subject_revision=pending["subject_revision"],
                subject_sha256=sha256,
                actor_id=actor,
                decision="rejected" if reject else "approved",
                decided_at=store.now(),
                note=note,
            )
        )
        typer.echo("Decision recorded. Use resume to continue.")
    except StateError:
        raise typer.BadParameter("unknown run or decision conflict") from None
    finally:
        store.close()


@app.command()
def cancel(run_id: str) -> None:
    """Request cancellation and finalize an idle local run."""
    config = WorkspaceConfig.from_env()
    store = StateStore.open(config.state_db)
    try:
        pipeline_controller(store, config).cancel(run_id)
        _resume(store, config, run_id)
    except StateError:
        raise typer.BadParameter("unknown run") from None
    finally:
        store.close()


@app.command("propose")
def propose_command(
    catalog: Path, output: Path, model: str = typer.Option(...), live: bool = typer.Option(False)
) -> None:
    """Opt-in provider proposal over an already sanitized catalog; never approves it."""
    if not live:
        raise typer.BadParameter("live provider calls require --live")
    if not os.environ.get("OPENAI_API_KEY"):
        raise typer.BadParameter("configure OPENAI_API_KEY locally; do not paste it into chat")
    if output.exists():
        raise typer.BadParameter("proposal output already exists")
    try:
        source = read_json_file(catalog, EvidenceCatalog)
        with OpenAI() as client:
            proposed = generate_proposal(source, OpenAIAdapter(client, model=model))
        with output.open("x", encoding="utf-8") as handle:
            handle.write(proposed.model_dump_json(indent=2))
    except (ValueError, OSError):
        typer.echo("Proposal failed. Check sanitized inputs and provider configuration.", err=True)
        raise typer.Exit(1) from None
    typer.echo("Proposal written. Human claims and scenario approvals are still required.")


if __name__ == "__main__":
    app()
