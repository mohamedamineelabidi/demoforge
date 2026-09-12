"""Foreground source-teaser stages over the existing authoritative controller."""

import html
import json
import zipfile
from io import BytesIO

from demoforge.pack.context_pack import assemble_context
from demoforge.pack.workspace import WorkspaceConfig
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.workflow.controller import Controller
from demoforge.workflow.stages import StageContext, StageOutcome, StageRequest
from demoforge.workflow.state import StateStore

STAGES = (
    ("teaser-source", "ingesting"),
    ("teaser-storyboard", "planning"),
    ("teaser-render", "rendering"),
    ("teaser-review", "reviewing"),
    ("teaser-export", "reviewing"),
)


class TeaserStage:
    def __init__(self, store, dependencies, stage_id, run_state):
        self.store = store
        self.dependencies = dependencies
        self.stage_id = stage_id
        self.run_state = run_state

    def run(self, request: StageRequest, ctx: StageContext) -> StageOutcome:
        workspace = ctx.workspace
        prefix = f"outputs/{request.attempt_id}"

        def publish(identity, data, media_type="application/json"):
            return workspace.publish_bytes(
                f"{prefix}/{identity}",
                data,
                media_type=media_type,
                artifact_id=identity,
            )

        def artifact(stage, identity):
            manifest = self.store.latest_manifest(request.run_id, stage)
            if not manifest or manifest.manifest_id not in request.input_manifest_ids:
                raise ValueError("missing declared input")
            ref = next(item for item in manifest.outputs if item.artifact_id == identity)
            if workspace.verify(ref):
                raise ValueError("artifact integrity check failed")
            return ref

        def data(stage, identity):
            return workspace.resolve(artifact(stage, identity).path).read_bytes()

        def require_approval(kind, ref):
            if not any(
                decision.decision == "approved"
                and decision.subject_revision == 1
                and decision.subject_sha256 == ref.sha256
                for decision in self.store.approvals_for(
                    request.run_id, kind, f"{kind}-{request.run_id}"
                )
            ):
                raise ValueError("exact artifact approval required")

        if self.stage_id == "teaser-source":
            snapshot = self.dependencies.source(request.options["repository_url"])
            catalog = assemble_context(snapshot, now=ctx.now()).catalog
            return StageOutcome(outputs=[publish("catalog", catalog.model_dump_json().encode())])

        catalog_bytes = data("teaser-source", "catalog")
        catalog = EvidenceCatalog.model_validate_json(catalog_bytes)
        if self.stage_id == "teaser-storyboard":
            spec = self.dependencies.prepare(catalog)
            self.dependencies.validate(spec, catalog)
            ref = publish("storyboard", spec.model_dump_json().encode())
            return StageOutcome(
                outputs=[ref],
                approval_subject=(
                    "storyboard",
                    f"storyboard-{request.run_id}",
                    1,
                    ref.sha256,
                ),
            )

        board_ref = artifact("teaser-storyboard", "storyboard")
        require_approval("storyboard", board_ref)
        board_bytes = data("teaser-storyboard", "storyboard")
        if self.stage_id == "teaser-render":
            spec = self.dependencies.prepare(catalog)
            spec = type(spec).model_validate_json(board_bytes)
            self.dependencies.validate(spec, catalog)
            target = workspace.resolve(f"{prefix}/rendering.mp4")
            target.parent.mkdir(parents=True, exist_ok=True)
            info = self.dependencies.render(spec, target)
            video = workspace.publish_file(
                f"{prefix}/video.mp4",
                target,
                media_type="video/mp4",
                artifact_id="video",
            )
            expected = dict(
                width=1920,
                height=1080,
                fps=30,
                frame_count=900,
                duration_seconds=30,
                has_audio=False,
                sha256=video.sha256,
            )
            if any(info.get(key) != value for key, value in expected.items()):
                raise ValueError("rendered output failed technical gates")
            return StageOutcome(outputs=[video, publish("measurements", json.dumps(info).encode())])

        video = artifact("teaser-render", "video")
        if self.stage_id == "teaser-review":
            return StageOutcome(
                outputs=[video],
                approval_subject=(
                    "output",
                    f"output-{request.run_id}",
                    1,
                    video.sha256,
                ),
            )

        if self.stage_id == "teaser-export":
            require_approval("output", video)
            measurements = data("teaser-render", "measurements")
            decisions = [
                decision.model_dump(mode="json")
                for kind in ("storyboard", "output")
                for decision in self.store.approvals_for(
                    request.run_id, kind, f"{kind}-{request.run_id}"
                )
            ]
            evidence = json.dumps(
                {
                    "catalog": json.loads(catalog_bytes),
                    "storyboard": json.loads(board_bytes),
                    "measurements": json.loads(measurements),
                    "approvals": decisions,
                    "scope": "Source quotations, not runtime-observed product behavior.",
                },
                indent=2,
            ).encode()
            quotes = "".join(
                f"<section><h2>{html.escape(item.evidence_id)}</h2>"
                f"<p>{html.escape(item.source)}</p><pre>{html.escape(item.quote)}</pre></section>"
                for item in catalog.evidence
            )
            review = (
                '<!doctype html><html lang="en"><meta charset="utf-8">'
                '<meta name="viewport" content="width=device-width,initial-scale=1">'
                "<title>DemoForge source teaser review</title>"
                "<style>body{font:16px system-ui;max-width:960px;margin:auto;padding:24px}"
                "video{width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere}"
                "p{overflow-wrap:anywhere}</style><h1>Source teaser review</h1>"
                "<p>Source quotations, not runtime-observed product behavior.</p>"
                '<video controls src="video.mp4"></video>'
                f"<p>Video SHA-256: {video.sha256}</p>{quotes}</html>"
            ).encode()
            bundle = BytesIO()
            with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.write(workspace.resolve(video.path), "video.mp4")
                archive.writestr("evidence.json", evidence)
                archive.writestr("review.html", review)
            return StageOutcome(
                outputs=[
                    video,
                    publish("evidence", evidence),
                    publish("review", review, "text/html"),
                    publish("bundle", bundle.getvalue(), "application/zip"),
                ]
            )
        raise ValueError("unknown teaser stage")


def teaser_controller(store: StateStore, config: WorkspaceConfig, dependencies) -> Controller:
    return Controller(
        store,
        config,
        [TeaserStage(store, dependencies, identity, state) for identity, state in STAGES],
    )
