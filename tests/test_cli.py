from typer.testing import CliRunner

from demoforge import __version__
from demoforge.cli import app


def test_serve_is_loopback_only(monkeypatch):
    calls = []
    monkeypatch.setattr("demoforge.api.server.serve_local", lambda config, port: calls.append(port))
    result = CliRunner().invoke(app, ["serve", "--port", "8000"])
    assert result.exit_code == 0, result.output
    assert calls == [8000]
    assert CliRunner().invoke(app, ["serve", "--host", "0.0.0.0"]).exit_code != 0
    assert CliRunner().invoke(app, ["serve", "--port", "0"]).exit_code != 0


def test_version_command_prints_version():
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.output


def test_help_describes_video_first_direction_and_foundation_status():
    result = CliRunner().invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "release-demo" in result.output
    assert "ingestion" in " ".join(result.output.split()).lower()
    assert "deck, docs and brand kit" not in result.output


def test_ingest_rejects_untrusted_urls_without_network():
    result = CliRunner().invoke(app, ["ingest", "https://untrusted.example/repo"])
    assert result.exit_code != 0
    assert "github.com" in result.output


def test_ingest_publishes_sanitized_catalog(monkeypatch, tmp_path):
    from demoforge.ingest.github import GitHubSource, Snapshot, SourceFile

    monkeypatch.setenv("DEMOFORGE_WORKSPACE", str(tmp_path))
    monkeypatch.setattr(
        GitHubSource,
        "acquire",
        lambda self, url, commit=None: Snapshot(
            "https://github.com/owner/repo",
            "owner/repo",
            "a" * 40,
            (SourceFile("README.md", b"# Demo\nPASSWORD=private-test-value\n"),),
            0,
        ),
    )
    result = CliRunner().invoke(app, ["ingest", "https://github.com/owner/repo"])
    assert result.exit_code == 0, result.output
    assert "ask_user" in result.output
    assert "private-test-value" not in result.output
    catalogs = list(tmp_path.glob("runs/*/curated/*/catalog.json"))
    assert len(catalogs) == 1
    assert "private-test-value" not in catalogs[0].read_text()


def test_run_pauses_and_approval_requires_exact_hash(monkeypatch, tmp_path):
    import json

    from demoforge.video.storyboard import artifact_hash
    from tests.video.test_storyboard import catalog, proposal

    monkeypatch.setenv("DEMOFORGE_WORKSPACE", str(tmp_path / "workspace"))
    source = catalog()
    planned = proposal().model_copy(update={"catalog_sha256": artifact_hash(source)})
    source_path, proposal_path = tmp_path / "catalog.json", tmp_path / "proposal.json"
    source_path.write_text(source.model_dump_json())
    proposal_path.write_text(planned.model_dump_json())
    footage = tmp_path / "footage.mp4"
    footage.write_bytes(b"not decoded before claims approval")
    runner = CliRunner()
    result = runner.invoke(
        app,
        [
            "run",
            str(source_path),
            str(proposal_path),
            str(footage),
            "--actor",
            "operator",
            "--provenance",
            "Supplied test footage",
            "--authorized",
            "--privacy-reviewed",
            "--sanitized-catalog",
        ],
    )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["state"] == "awaiting_approval"
    identity = payload["run_id"]
    status = runner.invoke(app, ["status", identity])
    assert status.exit_code == 0
    assert "claims" in status.output
    failed = runner.invoke(
        app,
        ["approve", identity, "--sha256", "f" * 64, "--actor", "operator", "--note", "Reviewed"],
    )
    assert failed.exit_code != 0
    decision = runner.invoke(
        app,
        [
            "approve",
            identity,
            "--sha256",
            payload["subject_sha256"],
            "--actor",
            "operator",
            "--note",
            "Reviewed exact claims",
        ],
    )
    assert decision.exit_code == 0, decision.output
    cancelled = runner.invoke(app, ["cancel", identity])
    assert cancelled.exit_code == 0
    assert "cancelled" in runner.invoke(app, ["status", identity]).output


def test_propose_requires_explicit_live_opt_in(tmp_path):
    result = CliRunner().invoke(
        app,
        [
            "propose",
            str(tmp_path / "catalog.json"),
            str(tmp_path / "proposal.json"),
            "--model",
            "test-model",
        ],
    )
    assert result.exit_code != 0
    assert "live" in result.output.lower()
