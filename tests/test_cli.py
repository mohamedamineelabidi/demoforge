from typer.testing import CliRunner

from demoforge import __version__
from demoforge.cli import app


def test_version_command_prints_version():
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.output
