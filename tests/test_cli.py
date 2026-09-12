from typer.testing import CliRunner

from demoforge import __version__
from demoforge.cli import app


def test_version_command_prints_version():
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.output


def test_help_describes_video_first_direction_and_foundation_status():
    result = CliRunner().invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "release-demo" in result.output
    assert "Foundation CLI only" in " ".join(result.output.split())
    assert "deck, docs and brand kit" not in result.output
