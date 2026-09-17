import threading
from http.client import HTTPConnection

import pytest

from demoforge.api.service import TeaserService
from demoforge.pack.workspace import WorkspaceConfig


@pytest.fixture
def server(tmp_path):
    from demoforge.api.server import make_server

    httpd = make_server(TeaserService(WorkspaceConfig(tmp_path / "data")), port=0)
    worker = threading.Thread(target=httpd.serve_forever)
    worker.start()
    yield httpd
    httpd.shutdown()
    worker.join()
    httpd.server_close()


def request(server, method="GET", path="/api/runs", body=None, headers=None):
    connection = HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    result = response.status, response.read(), dict(response.headers)
    connection.close()
    return result


def test_host_origin_and_body_limits(server):
    assert request(server)[0] == 200
    assert request(server, headers={"Host": "evil.test"})[0] == 403
    assert request(server, headers={"Origin": "http://evil.test"})[0] == 403
    assert request(server, "POST", body="{}")[0] == 403
    origin = f"http://127.0.0.1:{server.server_port}"
    headers = {"Origin": origin, "Content-Type": "application/json"}
    assert request(server, "POST", body="x" * 17000, headers=headers)[0] == 413
    assert request(server, "POST", body="[]", headers=headers)[0] == 400
    assert request(server, "POST", body="{}", headers=headers)[0] == 400
    assert request(server, path="/api/runs/../../private")[0] == 404


def test_create_idempotency_and_safe_errors(server):
    import json

    headers = {
        "Origin": f"http://127.0.0.1:{server.server_port}",
        "Content-Type": "application/json",
    }
    body = json.dumps(
        {"repository_url": "https://github.com/fixture/taskroom", "request_id": "a" * 32}
    )
    first = request(server, "POST", body=body, headers=headers)
    second = request(server, "POST", body=body, headers=headers)
    assert first[0] == second[0] == 200
    assert json.loads(first[1])["run_id"] == json.loads(second[1])["run_id"]
    assert len(json.loads(request(server)[1])["runs"]) == 1
    assert "nosniff" == first[2]["X-Content-Type-Options"]
    assert "no-store" == first[2]["Cache-Control"]
    assert request(server, path="/api/runs/teaser-" + "0" * 32)[0] == 404


def test_declared_preview_supports_ranges(tmp_path):
    from types import SimpleNamespace

    from demoforge.api.server import make_server

    target = tmp_path / "video.mp4"
    target.write_bytes(b"0123456789")

    def artifact(run_id, identity):
        if identity != "preview":
            raise ValueError("unknown artifact")
        return target, SimpleNamespace(media_type="video/mp4")

    httpd = make_server(SimpleNamespace(artifact=artifact), port=0)
    worker = threading.Thread(target=httpd.serve_forever)
    worker.start()
    try:
        path = "/api/runs/teaser-" + "a" * 32 + "/artifacts/preview"
        status, body, headers = request(httpd, path=path, headers={"Range": "bytes=3-5"})
        assert (status, body, headers["Content-Range"]) == (206, b"345", "bytes 3-5/10")
        assert request(httpd, path=path, headers={"Range": "bytes=10-"})[0] == 416
        assert request(httpd, path=path, headers={"Range": "bytes=8-2"})[0] == 416
        assert request(httpd, path=path.replace("preview", "secret"))[0] == 409
    finally:
        httpd.shutdown()
        worker.join()
        httpd.server_close()


def test_recorded_demo_endpoints(server):
    import json

    origin = f"http://127.0.0.1:{server.server_port}"
    headers = {"Origin": origin, "Content-Type": "application/json"}
    target_url = f"http://127.0.0.1:{server.server_port}/"
    body = json.dumps({"target_url": target_url, "goal": "Feature Walkthrough"})
    status, payload, _ = request(
        server, "POST", path="/api/recorded-demo", body=body, headers=headers
    )
    assert status == 200
    data = json.loads(payload)
    assert "job_id" in data
    assert data["target_url"].startswith("http://127.0.0.1:")
    
    # Query job status
    get_status, get_payload, _ = request(server, "GET", path=f"/api/recorded-demo/{data['job_id']}")
    assert get_status == 200
    get_data = json.loads(get_payload)
    assert get_data["job_id"] == data["job_id"]

