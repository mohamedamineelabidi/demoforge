"""Loopback-only static file server for local fixture apps.

Used to record the seeded fixture app without network access. Binds 127.0.0.1 only,
never lists directories and never serves paths outside the given folder.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class _FixtureHandler(SimpleHTTPRequestHandler):
    """Static handler: no directory listing, no traversal, silent logs."""

    def __init__(self, *args: object, root: Path, **kwargs: object) -> None:
        self._root = root  # must be set before super().__init__ handles the request
        super().__init__(*args, directory=str(root), **kwargs)  # type: ignore[arg-type]

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return

    def list_directory(self, path: str) -> None:  # type: ignore[override]
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")
        return None

    def send_head(self):  # type: ignore[no-untyped-def]
        raw = self.path.split("?", 1)[0].split("#", 1)[0]
        if ".." in raw or "\\" in raw or "%2e" in raw.lower() or "%2f" in raw.lower():
            self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return None
        resolved = Path(self.translate_path(self.path)).resolve()
        try:
            resolved.relative_to(self._root)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            return None
        return super().send_head()


def serve(directory: str | Path, port: int = 0) -> tuple[str, Callable[[], None]]:
    """Serve ``directory`` on 127.0.0.1 and return ``(url, stop)``.

    ``port=0`` picks a free port. ``stop`` shuts the server down and is idempotent.
    """
    root = Path(directory).resolve()
    if not root.is_dir():
        raise NotADirectoryError(str(root))
    handler = partial(_FixtureHandler, root=root)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True
    thread = threading.Thread(target=server.serve_forever, name="fixture-server", daemon=True)
    thread.start()
    host, bound_port = server.server_address[:2]
    url = f"http://{host}:{bound_port}"
    stopped = threading.Event()

    def stop() -> None:
        if stopped.is_set():
            return
        stopped.set()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    return url, stop
