from datetime import UTC, datetime

import pytest

from demoforge.ingest.github import Snapshot, SourceFile
from demoforge.pack.context_pack import assemble_context, publish_context
from demoforge.pack.workspace import RunWorkspace, WorkspaceConfig


def snapshot():
    return Snapshot(
        "https://github.com/owner/repo",
        "owner/repo",
        "a" * 40,
        (
            SourceFile(
                "README.md", b"# Product\nAPI_KEY=sample-private-value\nRun `uv run app.py`.\n"
            ),
            SourceFile(".env.example", b"PASSWORD=sample-private-value\n"),
            SourceFile("docs/binary.md", b"\xff\x00"),
        ),
        2,
    )


def test_catalog_is_sanitized_revision_pinned_and_not_claim_approval():
    context = assemble_context(snapshot(), now=datetime(2026, 9, 12, tzinfo=UTC))
    serialized = context.model_dump_json()
    assert "sample-private-value" not in serialized
    assert "uv run app.py" in serialized
    assert context.catalog.repository.commit_sha == "a" * 40
    assert context.catalog.claims == []
    assert context.catalog.support_errors() == []
    assert context.catalog.evidence[0].line_start == 1
    assert context.catalog.evidence[0].line_end == 3
    assert context.catalog.files[0].scan_status == "redacted"
    assert context.catalog.files[2].scan_status == "excluded"
    assert context.report.gate == "ask_user"
    assert context.report.blocks_completion()


def test_publish_only_sanitized_artifacts_and_refuse_overwrite(tmp_path):
    workspace = RunWorkspace.create(WorkspaceConfig(tmp_path), "context-test")
    context = assemble_context(snapshot(), now=datetime(2026, 9, 12, tzinfo=UTC))
    artifacts = publish_context(context, workspace)
    assert len(artifacts) == 3
    for artifact in artifacts:
        assert workspace.verify(artifact) == []
        assert b"sample-private-value" not in workspace.resolve(artifact.path).read_bytes()
    assert list(workspace.resolve("raw").iterdir()) == []
    with pytest.raises(ValueError, match="already exists"):
        publish_context(context, workspace)


def test_empty_snapshot_asks_for_documentation():
    source = Snapshot("https://github.com/owner/repo", "owner/repo", "a" * 40, (), 0)
    context = assemble_context(source, now=datetime(2026, 9, 12, tzinfo=UTC))
    assert "repository documentation" in context.report.missing_inputs
