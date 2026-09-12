"""Offline source review and output-hash-bound export eligibility."""

from html import escape

from demoforge.schemas.approval import Approval, approval_matches
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.schemas.quality import Check, QualityReport
from demoforge.video.import_media import MediaInfo


def technical_report(info: MediaInfo, *, output_id: str, revision: int) -> QualityReport:
    valid = (
        info.frame_count == 900
        and info.fps == 30
        and info.width == 1920
        and info.height == 1080
        and abs(info.duration_seconds - 30) <= 0.04
    )
    checks = [
        Check(
            check_id="pilot_format",
            status="pass" if valid else "fail",
            required=True,
            measurement={
                "frames": info.frame_count,
                "duration": info.duration_seconds,
                "width": info.width,
                "height": info.height,
                "fps": info.fps,
                "sha256": info.sha256,
            },
            reason=None if valid else "Pilot mismatch",
        ),
        Check(
            check_id="human_review",
            status="not_run",
            required=True,
            measurement=None,
            reason="Full output privacy, motion and evidence review required",
        ),
    ]
    if info.has_audio:
        checks.append(
            Check(
                check_id="audio_peak",
                status="not_run",
                required=True,
                measurement=None,
                reason="Encoded audio peak has not been measured",
            )
        )
    return QualityReport(
        schema_version=1,
        report_id=f"quality-{output_id}-{revision}",
        subject_id=output_id,
        subject_revision=revision,
        gate="ask_user" if valid else "fail",
        checks=checks,
        missing_inputs=["exact output human approval"],
        warnings=["Technical validity is not proof of product truth or privacy."],
    )


def export_allowed(
    run_id: str, info: MediaInfo, report: QualityReport, approvals: list[Approval]
) -> bool:
    current = technical_report(info, output_id=report.subject_id, revision=report.subject_revision)
    if report.gate == "fail" or current.gate == "fail" or info.has_audio:
        return False
    for check in report.checks:
        if check.required and check.check_id != "human_review" and check.status != "pass":
            return False
    pilot = next((check for check in report.checks if check.check_id == "pilot_format"), None)
    if not pilot or not pilot.measurement or pilot.measurement.get("sha256") != info.sha256:
        return False
    matching = [
        decision
        for decision in approvals
        if decision.run_id == run_id
        and decision.subject_type == "output"
        and decision.subject_id == report.subject_id
        and decision.subject_revision == report.subject_revision
        and decision.subject_sha256 == info.sha256
    ]
    if any(decision.decision == "rejected" for decision in matching):
        return False
    return any(
        approval_matches(
            decision, "output", report.subject_id, report.subject_revision, info.sha256
        )
        and decision.note
        and decision.note.strip()
        for decision in matching
    )


def review_html(catalog: EvidenceCatalog, report: QualityReport) -> str:
    status = (
        "Operator-approved output / See approval.json"
        if report.gate == "pass"
        else "Not approved for export"
    )
    evidence = "".join(
        f'<article id="{escape(item.evidence_id, quote=True)}"><h2>{escape(item.evidence_id)}</h2>'
        f"<p>{escape(item.source)} / lines {item.line_start}-{item.line_end}</p>"
        f"<p>Revision {escape(item.revision or 'not repository evidence')}</p>"
        f"<pre>{escape(item.quote)}</pre></article>"
        for item in catalog.evidence
    )
    checks = "".join(
        f"<li>{escape(check.check_id)}: {escape(check.status)}</li>" for check in report.checks
    )
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src 'self';
style-src 'unsafe-inline'; img-src 'self'">
<title>Output review</title><style>
body{{font:16px/1.5 'Segoe UI',sans-serif;color:#202321;background:#f7f8fa;
margin:0 auto;padding:24px;max-width:1100px}}video{{width:100%;aspect-ratio:16/9}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere}}p{{overflow-wrap:anywhere}}
article{{border-top:1px solid #ccd0cd;padding:16px 0}}h1{{font-size:28px}}
</style></head><body><h1>Output review</h1><p>{status}</p>
<video controls preload="metadata" src="video.mp4"></video>
<h2>Technical checks</h2><ul>{checks}</ul><h2>Source evidence</h2>{evidence}</body></html>"""
