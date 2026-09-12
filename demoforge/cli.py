"""Command-line entry point. Sub-commands are added phase by phase (see TASKS.md)."""

import typer

from demoforge import PRODUCT_NAME, __version__

app = typer.Typer(
    help=f"{PRODUCT_NAME}: turn a GitHub repository into a demo video, deck, docs and brand kit.",
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
