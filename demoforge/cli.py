"""Command-line entry point. Sub-commands are added phase by phase (see TASKS.md)."""

import typer

from demoforge import PRODUCT_NAME, __version__

app = typer.Typer(
    help=f"{PRODUCT_NAME}: source-linked release-demo videos (planned). Foundation CLI only.",
    no_args_is_help=True,
)


@app.callback()
def main() -> None:
    """Keep the app a command group even while it has a single sub-command."""


@app.command()
def version() -> None:
    """Print the installed version."""
    typer.echo(f"{PRODUCT_NAME} {__version__}")


if __name__ == "__main__":
    app()
