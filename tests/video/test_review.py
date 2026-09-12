from datetime import UTC, datetime

from demoforge.schemas.approval import Approval
from demoforge.video.import_media import MediaInfo, MediaPermission
from demoforge.video.review import export_allowed, review_html, technical_report
from tests.video.test_storyboard import catalog


def info():
    return MediaInfo(
        sha256="a" * 64,
        size_bytes=1000,
        width=1920,
        height=1080,
        fps=30,
        frame_count=900,
        duration_seconds=30,
        has_audio=False,
        permission=MediaPermission(
            actor_id="fixture", authorized=True, privacy_reviewed=True, provenance="Fixture"
        ),
    )


def test_technical_pass_does_not_approve_export():
    report = technical_report(info(), output_id="output", revision=1)
    assert report.gate == "ask_user"
    assert not export_allowed("run", info(), report, [])


def test_output_approval_is_bound_to_bytes_and_run():
    metadata = info()
    report = technical_report(metadata, output_id="output", revision=1)
    decision = Approval(
        schema_version=1,
        approval_id="decision",
        run_id="run",
        subject_type="output",
        subject_id="output",
        subject_revision=1,
        subject_sha256=metadata.sha256,
        actor_id="operator",
        decision="approved",
        decided_at=datetime(2026, 9, 12, tzinfo=UTC),
        note="Full output privacy, motion and evidence reviewed",
    )
    assert export_allowed("run", metadata, report, [decision])
    assert not export_allowed("other", metadata, report, [decision])
    changed = metadata.model_copy(update={"sha256": "b" * 64})
    assert not export_allowed("run", changed, report, [decision])
    broken = metadata.model_copy(update={"frame_count": 899})
    assert not export_allowed("run", broken, report, [decision])


def test_offline_review_escapes_sources():
    source = catalog()
    source.evidence[0] = source.evidence[0].model_copy(
        update={"quote": "<script>alert(1)</script>"}
    )
    report = technical_report(info(), output_id="output", revision=1)
    html = review_html(source, report)
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert 'src="video.mp4"' in html
    assert "Content-Security-Policy" in html
    assert "https://" not in html.split("<style>")[1].split("</style>")[0]


def test_audio_is_not_silently_approved_without_peak_gate():
    report = technical_report(
        info().model_copy(update={"has_audio": True}), output_id="output", revision=1
    )
    assert any(
        check.check_id == "audio_peak" and check.status == "not_run" for check in report.checks
    )
