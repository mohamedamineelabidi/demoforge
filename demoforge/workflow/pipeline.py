"""Local supplied-footage pipeline adapters over the existing SQLite controller."""

import shutil
from pathlib import Path

from demoforge.pack.workspace import WorkspaceConfig
from demoforge.quality.secrets import sanitize_text
from demoforge.schemas._base import StrictModel
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.schemas.quality import QualityReport
from demoforge.video.assemble import render_video
from demoforge.video.import_media import MediaInfo, MediaPermission, inspect_media, normalize_media
from demoforge.video.review import export_allowed, review_html, technical_report
from demoforge.video.storyboard import (
    Proposal,
    Scenario,
    Scene,
    Storyboard,
    artifact_hash,
    validate_grounding,
)
from demoforge.workflow.controller import Controller
from demoforge.workflow.stages import StageContext, StageOutcome, StageRequest
from demoforge.workflow.state import StateStore


def read_json_file(path: Path, model: type[StrictModel]) -> StrictModel:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 2_000_000:
        raise ValueError("input must be a bounded regular JSON file")
    with path.open("rb") as handle:
        data = handle.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("JSON input limit exceeded")
    try:
        return model.model_validate_json(data)
    except ValueError:
        raise ValueError("input JSON does not match the required schema") from None


class PipelineStage:
    def __init__(self, store: StateStore, stage_id: str, run_state: str):
        self.store = store
        self.stage_id = stage_id
        self.run_state = run_state

    def run(self, request: StageRequest, ctx: StageContext) -> StageOutcome:
        workspace = ctx.workspace
        prefix = f"curated/{request.attempt_id}"

        def publish(name: str, model: StrictModel):
            return workspace.publish_bytes(
                f"{prefix}/{name}.json",
                model.model_dump_json().encode(),
                media_type="application/json",
                artifact_id=name,
            )

        def ref(stage: str, identity: str):
            manifest = self.store.latest_manifest(request.run_id, stage)
            if manifest is None or manifest.manifest_id not in request.input_manifest_ids:
                raise ValueError("missing declared input manifest")
            artifact = next(
                (item for item in manifest.outputs if item.artifact_id == identity), None
            )
            if artifact is None or workspace.verify(artifact):
                raise ValueError("input artifact integrity failure")
            return artifact

        def read(stage: str, identity: str, model):
            return read_json_file(workspace.resolve(ref(stage, identity).path), model)

        def decisions(subjects):
            return [
                decision
                for kind, identity in subjects
                for decision in self.store.approvals_for(request.run_id, kind, identity)
            ]

        if self.stage_id == "source":
            if request.options.get("sanitized_catalog_confirmed") is not True:
                raise ValueError("sanitized catalog confirmation required")
            catalog = read_json_file(Path(request.options["catalog"]), EvidenceCatalog)
            if catalog.support_errors() or any(
                record.scan_status == "not_scanned" for record in catalog.files
            ):
                raise ValueError("catalog has unsupported claims or unscanned files")
            if any(sanitize_text(evidence.quote).redacted for evidence in catalog.evidence):
                raise ValueError("catalog contains text requiring further redaction")
            proposed = read_json_file(Path(request.options["proposal"]), Proposal)
            if proposed.catalog_sha256 != artifact_hash(catalog):
                raise ValueError("proposal catalog hash mismatch")
            validate_grounding(proposed, catalog)
            return StageOutcome(
                outputs=[publish("catalog", catalog), publish("proposal", proposed)]
            )

        catalog = read("source", "catalog", EvidenceCatalog)
        proposed = read("source", "proposal", Proposal)
        if self.stage_id == "claims":
            artifact = publish("proposal", proposed)
            return StageOutcome(
                outputs=[artifact],
                approval_subject=(
                    "claims",
                    proposed.proposal_id,
                    proposed.revision,
                    artifact_hash(proposed),
                ),
            )

        if self.stage_id == "footage":
            permission = MediaPermission.model_validate(request.options["permission"])
            target = workspace.resolve(f"{prefix}/media.mp4")
            target.parent.mkdir(parents=True, exist_ok=True)
            normalized = normalize_media(Path(request.options["footage"]), target, permission)
            scenario = Scenario(
                scenario_id=f"scenario-{request.run_id}",
                revision=1,
                proposal_sha256=artifact_hash(proposed),
                media_sha256=normalized.sha256,
                source_in=request.options.get("source_in", [0, 180, 660]),
            )
            media_ref = workspace.publish_file(
                f"{prefix}/normalized.mp4", target, media_type="video/mp4", artifact_id="media"
            )
            return StageOutcome(
                outputs=[
                    media_ref,
                    publish("media-info", normalized),
                    publish("scenario", scenario),
                ],
                approval_subject=(
                    "scenario",
                    scenario.scenario_id,
                    scenario.revision,
                    artifact_hash(scenario),
                ),
            )

        media = read("footage", "media-info", MediaInfo)
        scenario = read("footage", "scenario", Scenario)
        media_path = workspace.resolve(ref("footage", "media").path)
        if self.stage_id == "storyboard":
            scenes = [
                Scene(start_frame=start, end_frame=end, source_in=source_in, caption=caption)
                for (start, end), source_in, caption in zip(
                    [(0, 180), (180, 660), (660, 900)],
                    scenario.source_in,
                    proposed.captions,
                    strict=True,
                )
            ]
            board = Storyboard(
                storyboard_id=f"storyboard-{request.run_id}",
                revision=1,
                proposal_sha256=artifact_hash(proposed),
                media_sha256=media.sha256,
                media_frames=media.frame_count,
                scenes=scenes,
            )
            artifact = publish("storyboard", board)
            return StageOutcome(
                outputs=[artifact],
                approval_subject=(
                    "storyboard",
                    board.storyboard_id,
                    board.revision,
                    artifact_hash(board),
                ),
            )

        board = read("storyboard", "storyboard", Storyboard)
        if self.stage_id == "render":
            target = workspace.resolve(f"outputs/{request.attempt_id}/video.mp4")
            target.parent.mkdir(parents=True, exist_ok=True)
            rendered = render_video(
                media_path,
                target,
                run_id=request.run_id,
                catalog=catalog,
                proposal=proposed,
                scenario=scenario,
                storyboard=board,
                permission=media.permission,
                approvals=decisions(
                    [
                        ("claims", proposed.proposal_id),
                        ("scenario", scenario.scenario_id),
                        ("storyboard", board.storyboard_id),
                    ]
                ),
            )
            video = workspace.publish_file(
                f"outputs/{request.attempt_id}/rendered.mp4",
                target,
                media_type="video/mp4",
                artifact_id="video",
            )
            return StageOutcome(outputs=[video, publish("render-info", rendered)])

        video = ref("render", "video")
        rendered = read("render", "render-info", MediaInfo)
        output_id = f"output-{request.run_id}"
        if self.stage_id == "review":
            report = technical_report(rendered, output_id=output_id, revision=1)
            if report.gate == "fail" or rendered.has_audio:
                raise ValueError("technical output gate failed")
            folder = f"outputs/{request.attempt_id}"
            copied = workspace.resolve(f"{folder}/video.mp4")
            copied.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(workspace.resolve(video.path), copied)
            review_video = workspace.publish_file(
                f"{folder}/video.mp4", copied, media_type="video/mp4", artifact_id="review-video"
            )
            html = workspace.publish_bytes(
                f"{folder}/review.html",
                review_html(catalog, report).encode(),
                media_type="text/html",
                artifact_id="review-page",
            )
            return StageOutcome(
                outputs=[publish("quality", report), html, review_video],
                approval_subject=("output", output_id, 1, rendered.sha256),
            )

        if self.stage_id == "export":
            report = read("review", "quality", QualityReport)
            current = inspect_media(workspace.resolve(video.path), media.permission)
            if not export_allowed(
                request.run_id, current, report, decisions([("output", output_id)])
            ):
                raise ValueError("current output approval and passing technical gates required")
            target = workspace.resolve("outputs/export/video.mp4")
            target.parent.mkdir(parents=True, exist_ok=True)
            with (
                target.open("xb") as destination,
                workspace.resolve(video.path).open("rb") as source,
            ):
                shutil.copyfileobj(source, destination)
            artifact = workspace.publish_file(
                "outputs/export/video.mp4", target, media_type="video/mp4", artifact_id="export"
            )
            output_decision = next(
                decision
                for decision in decisions([("output", output_id)])
                if decision.decision == "approved"
                and decision.subject_sha256 == current.sha256
                and decision.subject_revision == report.subject_revision
            )
            exported_report = report.model_copy(deep=True)
            for check in exported_report.checks:
                if check.check_id == "human_review":
                    check.status = "pass"
                    check.reason = "Operator attested full output review; see approval.json"
            exported_report.gate = "pass"
            exported_report.missing_inputs = []
            exported_report = QualityReport.model_validate(exported_report.model_dump())
            outputs = [artifact]
            for name, model in [
                ("catalog", catalog),
                ("proposal", proposed),
                ("scenario", scenario),
                ("storyboard", board),
                ("quality", exported_report),
                ("approval", output_decision),
            ]:
                outputs.append(
                    workspace.publish_bytes(
                        f"outputs/export/{name}.json",
                        model.model_dump_json(indent=2).encode(),
                        media_type="application/json",
                        artifact_id=f"export-{name}",
                    )
                )
            outputs.append(
                workspace.publish_bytes(
                    "outputs/export/review.html",
                    review_html(catalog, exported_report).encode(),
                    media_type="text/html",
                    artifact_id="export-review",
                )
            )
            return StageOutcome(outputs=outputs)
        raise ValueError("unknown pipeline stage")


def pipeline_controller(store: StateStore, config: WorkspaceConfig) -> Controller:
    stages = [
        ("source", "ingesting"),
        ("claims", "planning"),
        ("footage", "acquiring_footage"),
        ("storyboard", "storyboarding"),
        ("render", "rendering"),
        ("review", "reviewing"),
        ("export", "reviewing"),
    ]
    return Controller(
        store, config, [PipelineStage(store, identity, state) for identity, state in stages]
    )
