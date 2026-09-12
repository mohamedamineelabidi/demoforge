"""Read a bounded, revision-pinned GitHub snapshot without a working-tree checkout."""

import base64
import binascii
import hashlib
import json
import re
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx

_SHA = re.compile(r"[a-f0-9]{40}")
_SEGMENT = re.compile(r"[A-Za-z0-9_.-]+")
_IGNORED = {
    "node_modules",
    "vendor",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".next",
    ".nuxt",
    "out",
    "target",
    "__pycache__",
    ".venv",
    ".git",
}
_RESERVED = re.compile(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", re.I)


class AcquisitionError(ValueError):
    """A sanitized acquisition failure safe to report to the caller."""


@dataclass(frozen=True)
class Limits:
    max_files: int = 500
    max_file_bytes: int = 256_000
    max_total_bytes: int = 4_000_000
    max_response_bytes: int = 2_000_000
    max_tree_entries: int = 10_000
    max_requests: int = 50
    max_depth: int = 12
    timeout_seconds: float = 10
    total_seconds: float = 120

    def __post_init__(self):
        for value in vars(self).values():
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not 0 < value < 1e9
            ):
                raise ValueError("limits must be positive finite numbers")


@dataclass(frozen=True)
class SourceFile:
    path: str
    content: bytes


@dataclass(frozen=True)
class Snapshot:
    repo_url: str
    full_name: str
    commit_sha: str
    files: tuple[SourceFile, ...]
    skipped_count: int


def parse_repository(url: str) -> str:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "github.com"
        or parsed.query
        or parsed.fragment
        or len(url) > 300
    ):
        raise ValueError("use an HTTPS github.com owner/repository URL")
    parts = parsed.path.strip("/").split("/")
    if len(parts) != 2 or any(
        not _SEGMENT.fullmatch(part) or part in {".", ".."} for part in parts
    ):
        raise ValueError("use an HTTPS github.com owner/repository URL")
    if parts[1].endswith(".git"):
        parts[1] = parts[1][:-4]
    if not parts[1] or parts[1] in {".", ".."}:
        raise ValueError("repository name is invalid")
    return "/".join(parts)


def _safe_path(path: object, depth: int) -> str:
    if not isinstance(path, str) or len(path) > 500:
        raise AcquisitionError("unsafe source path")
    parts = path.split("/")
    if len(parts) > depth or any(
        not part
        or part in {".", ".."}
        or part.endswith((".", " "))
        or _RESERVED.fullmatch(part)
        or any(ord(char) < 32 or char in '\\:<>"|?*' for char in part)
        for part in parts
    ):
        raise AcquisitionError("unsafe source path")
    return path


def classification(path: str) -> str | None:
    parts = path.lower().split("/")
    name = parts[-1]
    if any(part in _IGNORED for part in parts) or name.endswith((".lock", ".min.js", ".min.css")):
        return None
    if name == ".env.example":
        return "config"
    if name.startswith(".env") or name in {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"}:
        return None
    if name.startswith("readme"):
        return "readme"
    if name in {"package.json", "pyproject.toml", "cargo.toml", "go.mod", "requirements.txt"}:
        return "manifest"
    if name.startswith(("license", "copying")):
        return "license"
    if name.endswith((".md", ".rst", ".txt")):
        return "docs"
    return None


class GitHubSource:
    def __init__(self, client: httpx.Client, limits: Limits | None = None):
        self.client = client
        self.limits = limits or Limits()

    def acquire(self, url: str, *, commit: str | None = None) -> Snapshot:
        full_name = parse_repository(url)
        if commit is not None and not _SHA.fullmatch(commit):
            raise AcquisitionError("commit must be a full lowercase SHA-1")
        started = time.monotonic()
        requests = 0

        def get(path: str) -> dict:
            nonlocal requests
            requests += 1
            if requests > self.limits.max_requests:
                raise AcquisitionError("request budget exceeded")
            if time.monotonic() - started > self.limits.total_seconds:
                raise AcquisitionError("acquisition timed out")
            try:
                with self.client.stream(
                    "GET",
                    f"https://api.github.com/repos/{full_name}/{path}",
                    timeout=self.limits.timeout_seconds,
                    follow_redirects=False,
                    headers={
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                ) as response:
                    if response.status_code != 200:
                        raise AcquisitionError(
                            f"GitHub request failed (HTTP {response.status_code})"
                        )
                    content = bytearray()
                    for chunk in response.iter_bytes(chunk_size=16_384):
                        if time.monotonic() - started > self.limits.total_seconds:
                            raise AcquisitionError("acquisition timed out")
                        content.extend(chunk)
                        if len(content) > self.limits.max_response_bytes:
                            raise AcquisitionError("response byte budget exceeded")
                    value = json.loads(content)
                    if not isinstance(value, dict):
                        raise AcquisitionError("invalid GitHub response")
                    return value
            except httpx.TimeoutException:
                raise AcquisitionError("GitHub request timed out") from None
            except (httpx.HTTPError, ValueError) as error:
                if isinstance(error, AcquisitionError):
                    raise
                raise AcquisitionError("invalid or unavailable GitHub response") from None

        try:
            revision = get(f"commits/{commit or 'HEAD'}")
            commit_sha = revision["sha"]
            tree_sha = revision["commit"]["tree"]["sha"]
            if not _SHA.fullmatch(commit_sha) or not _SHA.fullmatch(tree_sha):
                raise AcquisitionError("invalid revision response")
            if commit is not None and commit_sha != commit:
                raise AcquisitionError("repository revision mismatch")
            tree = get(f"git/trees/{tree_sha}?recursive=1")
            if tree.get("truncated") is not False:
                raise AcquisitionError("truncated repository tree")
            entries = tree["tree"]
            if not isinstance(entries, list) or len(entries) > self.limits.max_tree_entries:
                raise AcquisitionError("tree entry budget exceeded")
            files = []
            seen = set()
            skipped = total_bytes = 0
            for entry in entries:
                path = _safe_path(entry["path"], self.limits.max_depth)
                if path.casefold() in seen:
                    raise AcquisitionError("duplicate source path")
                seen.add(path.casefold())
                if entry["type"] == "tree":
                    continue
                if entry["mode"] not in {"100644", "100755"} or not classification(path):
                    skipped += 1
                    continue
                size = entry["size"]
                if type(size) is not int or size < 0 or size > self.limits.max_file_bytes:
                    raise AcquisitionError("file byte budget exceeded")
                total_bytes += size
                if total_bytes > self.limits.max_total_bytes or len(files) >= self.limits.max_files:
                    raise AcquisitionError("snapshot file or byte budget exceeded")
                blob_sha = entry["sha"]
                if not _SHA.fullmatch(blob_sha):
                    raise AcquisitionError("invalid blob hash")
                blob = get(f"git/blobs/{blob_sha}")
                if blob["encoding"] != "base64" or blob["size"] != size:
                    raise AcquisitionError("invalid blob metadata")
                data = base64.b64decode("".join(blob["content"].split()), validate=True)
                if len(data) != size:
                    raise AcquisitionError("blob byte count mismatch")
                digest = hashlib.sha1(b"blob " + str(size).encode() + b"\0" + data).hexdigest()
                if digest != blob_sha:
                    raise AcquisitionError("blob hash mismatch")
                files.append(SourceFile(path, data))
            return Snapshot(
                f"https://github.com/{full_name}", full_name, commit_sha, tuple(files), skipped
            )
        except (KeyError, TypeError, binascii.Error):
            raise AcquisitionError("invalid GitHub source metadata") from None
