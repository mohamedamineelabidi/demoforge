import base64
import hashlib

import httpx
import pytest

from demoforge.ingest.github import AcquisitionError, GitHubSource, Limits, parse_repository

COMMIT = "a" * 40
TREE = "b" * 40
CONTENT = b"# Sample\nAPI_KEY=sample-private-value\n"
BLOB = hashlib.sha1(b"blob " + str(len(CONTENT)).encode() + b"\0" + CONTENT).hexdigest()


def client_for(*, path="README.md", mode="100644", truncated=False, status=200, content=CONTENT):
    def respond(request):
        assert request.url.host == "api.github.com"
        if status != 200:
            return httpx.Response(status, text="private-response-do-not-log")
        if "/commits/" in request.url.path:
            return httpx.Response(200, json={"sha": COMMIT, "commit": {"tree": {"sha": TREE}}})
        if "/trees/" in request.url.path:
            return httpx.Response(
                200,
                json={
                    "truncated": truncated,
                    "tree": [
                        {
                            "path": path,
                            "mode": mode,
                            "type": "blob",
                            "sha": BLOB,
                            "size": len(CONTENT),
                        },
                    ],
                },
            )
        return httpx.Response(
            200,
            json={
                "encoding": "base64",
                "size": len(content),
                "content": base64.b64encode(content).decode(),
            },
        )

    return httpx.Client(transport=httpx.MockTransport(respond))


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.test/a/b",
        "http://github.com/a/b",
        "https://github.com/a/b?token=hidden",
        "https://github.com/a/../b",
        "https://name:pass@github.com/a/b",
        "https://github.com/a/b/tree/main",
    ],
)
def test_reject_untrusted_repository_urls(url):
    with pytest.raises(ValueError):
        parse_repository(url)


def test_pinned_acquisition_returns_verified_bytes():
    with client_for() as client:
        result = GitHubSource(client).acquire("https://github.com/owner/repo", commit=COMMIT)
    assert result.commit_sha == COMMIT
    assert result.files[0].content == CONTENT
    assert result.files[0].path == "README.md"


@pytest.mark.parametrize(
    "path",
    [
        "../README.md",
        "C:/README.md",
        "docs\\README.md",
        "docs/../../README.md",
        "docs/CON",
        "docs/readme.md:secret",
        "docs./README.md",
    ],
)
def test_reject_unsafe_tree_paths(path):
    with client_for(path=path) as client, pytest.raises(AcquisitionError, match="path"):
        GitHubSource(client).acquire("https://github.com/owner/repo")


def test_symlinks_are_never_downloaded():
    with client_for(mode="120000") as client:
        result = GitHubSource(client).acquire("https://github.com/owner/repo")
    assert result.files == ()
    assert result.skipped_count == 1


@pytest.mark.parametrize("status", [301, 403, 429, 500])
def test_http_failures_do_not_leak_response_bodies(status):
    with client_for(status=status) as client, pytest.raises(AcquisitionError) as caught:
        GitHubSource(client).acquire("https://github.com/owner/repo")
    assert "private-response" not in str(caught.value)


def test_reject_truncated_tree():
    with client_for(truncated=True) as client, pytest.raises(AcquisitionError, match="truncated"):
        GitHubSource(client).acquire("https://github.com/owner/repo")


def test_reject_blob_hash_mismatch():
    with client_for(content=b"changed") as client, pytest.raises(AcquisitionError):
        GitHubSource(client).acquire("https://github.com/owner/repo")


def test_request_byte_budget():
    with client_for() as client, pytest.raises(AcquisitionError, match="byte"):
        GitHubSource(client, Limits(max_response_bytes=10)).acquire("https://github.com/owner/repo")


def test_timeout_is_sanitized():
    def timeout(request):
        raise httpx.ReadTimeout("private-internal-data", request=request)

    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        with pytest.raises(AcquisitionError, match="timed out") as caught:
            GitHubSource(client).acquire("https://github.com/owner/repo")
    assert "private-internal" not in str(caught.value)
