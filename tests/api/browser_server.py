"""Test-only bounded source injection. Not an application endpoint or production mode."""

import argparse
from pathlib import Path
from tempfile import TemporaryDirectory

from demoforge.api.server import make_server
from demoforge.api.service import TeaserDependencies, TeaserService
from demoforge.ingest.github import Snapshot, SourceFile
from demoforge.pack.workspace import WorkspaceConfig


def fixture_source(url):
    if url != "https://github.com/fixture/taskroom":
        raise ValueError("Only the bounded test fixture is authorized")
    return Snapshot(
        url,
        "fixture/taskroom",
        "a" * 40,
        (
            SourceFile(
                "README.md", b"# Taskroom\n\nOrganize team tasks.\n\nFilter completed tasks.\n"
            ),
        ),
        0,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8018)
    args = parser.parse_args()
    with TemporaryDirectory(prefix="demoforge-browser-") as temporary:
        service = TeaserService(
            WorkspaceConfig(Path(temporary)), TeaserDependencies(source=fixture_source)
        )
        frontend = Path(__file__).resolve().parents[2] / "frontend" / "dist"
        with make_server(service, port=args.port, frontend=frontend) as server:
            print(f"Fixture API ready on 127.0.0.1:{args.port}", flush=True)
            server.serve_forever()


if __name__ == "__main__":
    main()
