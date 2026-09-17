"""Single foreground loopback HTTP adapter. No render workers or remote origins."""

import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from demoforge.api.service import TeaserService
from demoforge.workflow.state import StateError, UnknownRunError

MAX_BODY = 16_384
RUN_PATH = r"/api/runs/(teaser-[a-f0-9]{32})"


class LocalServer(HTTPServer):
    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(10)
        return connection, address


def make_server(service: TeaserService, *, port=8000, frontend: Path | None = None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def headers_out(self, status, content_type, length, extra=None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(length))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; media-src 'self' blob:; "
                "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
            )
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()

        def respond(self, status, value):
            data = json.dumps(value).encode()
            self.headers_out(status, "application/json", len(data))
            self.wfile.write(data)

        def guard(self, mutation=False):
            hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            origins = {f"http://{host}" for host in hosts} | {
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
                "http://localhost:5173",
                "http://localhost:5174",
            }
            host = self.headers.get_all("Host", [])
            origin = self.headers.get_all("Origin", [])
            if (
                len(host) != 1
                or host[0] not in hosts
                or len(origin) > 1
                or (origin and origin[0] not in origins)
                or (mutation and not origin)
                or self.headers.get("Sec-Fetch-Site") == "cross-site"
            ):
                self.respond(
                    403, {"error": "Only the trusted local application may access this API."}
                )
                return False
            return True

        def do_POST(self):
            try:
                if not self.guard(mutation=True):
                    return
                lengths = self.headers.get_all("Content-Length", [])
                if (
                    self.headers.get("Transfer-Encoding")
                    or len(lengths) != 1
                    or not lengths[0].isdigit()
                ):
                    self.respond(400, {"error": "A bounded JSON body is required."})
                    return
                length = int(lengths[0])
                if length > MAX_BODY:
                    self.respond(413, {"error": "Request body exceeds 16 KiB."})
                    return
                if self.headers.get_content_type() != "application/json":
                    self.respond(415, {"error": "Use application/json."})
                    return
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError("incomplete body")
                body = json.loads(raw)
                if not isinstance(body, dict):
                    raise ValueError("object required")
                path = self.path
                if path == "/api/recorded-demo":
                    if (
                        not isinstance(body, dict)
                        or "target_url" not in body
                        or not isinstance(body["target_url"], str)
                    ):
                        raise ValueError("target_url string is required")
                    job = service.recorded_demo.create_job(
                        body["target_url"],
                        goal=body.get("goal"),
                    )
                    self.respond(200, job.model_dump())
                    return
                elif path == "/api/runs":
                    if set(body) != {"repository_url", "request_id"} or not all(
                        isinstance(value, str) for value in body.values()
                    ):
                        raise ValueError("invalid create request")
                    result = service.create(body["repository_url"], body["request_id"])
                else:
                    match = re.fullmatch(RUN_PATH + r"/(advance|approve|cancel)", path)
                    if not match:
                        self.respond(404, {"error": "Unknown endpoint."})
                        return
                    run_id, action = match.groups()
                    if action == "approve":
                        if (
                            set(body) != {"subject", "actor", "note", "reviewed"}
                            or not isinstance(body["subject"], dict)
                            or not isinstance(body["actor"], str)
                            or not isinstance(body["note"], str)
                            or len(body["actor"]) > 100
                            or len(body["note"]) > 2000
                        ):
                            raise ValueError("invalid approval request")
                        result = service.approve(run_id, **body)
                    else:
                        if body:
                            raise ValueError("empty object required")
                        result = getattr(service, action)(run_id)
                self.respond(200, result)
            except UnknownRunError:
                self.respond(404, {"error": "Run not found."})
            except (ValueError, StateError, KeyError, TypeError):
                self.respond(
                    400,
                    {
                        "error": (
                            "Request rejected. Refresh the run and verify its inputs "
                            "or exact approval."
                        )
                    },
                )
            except (TimeoutError, BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self.respond(
                    500, {"error": "Local operation failed. Check storage and tool installation."}
                )

        def do_GET(self):
            try:
                if not self.guard():
                    return
                if self.path == "/api/health":
                    self.respond(200, {"status": "ready", "mode": "local-foreground"})
                elif match := re.fullmatch(r"/api/recorded-demo/([a-zA-Z0-9_-]+)/video", self.path):
                    video_path = service.recorded_demo.get_video_path(match[1])
                    disposition = {"Content-Disposition": 'attachment; filename="demo.mp4"'}
                    self.send_file(video_path, "video/mp4", disposition)
                elif match := re.fullmatch(r"/api/recorded-demo/([a-zA-Z0-9_-]+)", self.path):
                    job = service.recorded_demo.get_job(match[1])
                    self.respond(200, job.model_dump())
                elif self.path == "/api/runs":
                    self.respond(200, {"runs": service.list_runs()})
                elif match := re.fullmatch(RUN_PATH, self.path):
                    self.respond(200, service.get(match[1]))
                elif match := re.fullmatch(RUN_PATH + r"/artifacts/([a-z]+)", self.path):
                    path, ref = service.artifact(match[1], match[2])
                    extra = {}
                    if match[2] != "preview":
                        extension = {
                            "video": "mp4",
                            "bundle": "zip",
                            "evidence": "json",
                            "review": "html",
                        }[match[2]]
                        extra["Content-Disposition"] = (
                            f'attachment; filename="{match[2]}.{extension}"'
                        )
                    self.send_file(path, ref.media_type, extra)
                elif frontend and not self.path.startswith("/api/"):
                    relative = urlsplit(self.path).path.lstrip("/") or "index.html"
                    path = (frontend / relative).resolve()
                    if frontend.resolve() not in path.parents or not path.is_file():
                        self.respond(404, {"error": "Page not found. Build the frontend first."})
                        return
                    self.send_file(
                        path, mimetypes.guess_type(path)[0] or "application/octet-stream"
                    )
                else:
                    self.respond(404, {"error": "Unknown endpoint."})
            except UnknownRunError:
                self.respond(404, {"error": "Run not found."})
            except (ValueError, StateError):
                self.respond(
                    409, {"error": "Artifact unavailable, unapproved or changed. Refresh the run."}
                )
            except (TimeoutError, BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                self.respond(500, {"error": "Local storage could not be read."})

        def send_file(self, path, media_type, extra=None):
            size = path.stat().st_size
            start, end = 0, size - 1
            status = 200
            headers = dict(extra or {})
            headers["Accept-Ranges"] = "bytes"
            if requested := self.headers.get("Range"):
                match = re.fullmatch(r"bytes=(\d+)-(\d*)", requested)
                if not match or int(match[1]) >= size:
                    self.headers_out(416, media_type, 0, {"Content-Range": f"bytes */{size}"})
                    return
                start = int(match[1])
                end = min(int(match[2]), end) if match[2] else end
                if end < start:
                    self.headers_out(416, media_type, 0)
                    return
                status = 206
                headers["Content-Range"] = f"bytes {start}-{end}/{size}"
            self.headers_out(status, media_type, end - start + 1, headers)
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk = handle.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)

    return LocalServer(("127.0.0.1", port), Handler)


def serve_local(config, *, port=8000):
    frontend = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    service = TeaserService(config)
    with make_server(service, port=port, frontend=frontend) as server:
        service.recover()
        print(f"DemoForge local: http://127.0.0.1:{server.server_port}", flush=True)
        server.serve_forever()
