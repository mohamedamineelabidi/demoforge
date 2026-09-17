"""Unit tests for the RecordedDemoService."""

from pathlib import Path

import pytest

from demoforge.api.recorded_service import RecordedDemoService


def test_create_and_get_job(tmp_path: Path):
    service = RecordedDemoService(workspace_dir=tmp_path)
    job = service.create_job("http://127.0.0.1:8000/", goal="Showcase Task Management")
    
    assert job.target_url == "http://127.0.0.1:8000/"
    assert job.status in ("pending", "ready")
    
    retrieved = service.get_job(job.job_id)
    assert retrieved.job_id == job.job_id


def test_reject_unauthorized_url(tmp_path: Path):
    service = RecordedDemoService(workspace_dir=tmp_path)
    with pytest.raises(ValueError, match="not authorized"):
        service.create_job("http://malicious.external.site")

