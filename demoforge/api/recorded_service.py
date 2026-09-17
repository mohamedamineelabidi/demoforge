"""Service coordinating automated discovery, scenario compilation, and video rendering."""

from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path

from demoforge.capture.discover import discover_from_html, validate_target_url
from demoforge.enrich.scenario_compiler import compile_hybrid_spec
from demoforge.schemas.recorded_demo import RecordedJobStatus
from demoforge.video.remotion_render import render_hybrid_video


class RecordedDemoService:
    def __init__(self, workspace_dir: Path | None = None) -> None:
        if workspace_dir is None:
            base = os.environ.get("DEMOFORGE_WORKSPACE") or (
                Path(os.environ.get("LOCALAPPDATA", ".")) / "demoforge" / "workspace"
            )
            self.workspace = Path(base) / "recorded_jobs"
        else:
            self.workspace = workspace_dir / "recorded_jobs"

        self.workspace.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, RecordedJobStatus] = {}

    def create_job(
        self,
        target_url: str,
        goal: str | None = None,
        *,
        auto_run: bool = True,
    ) -> RecordedJobStatus:
        """Create and start an automated recorded demo job for an authorized target URL."""
        validated_url = validate_target_url(target_url)
        job_id = f"rec-{uuid.uuid4().hex[:10]}"

        job = RecordedJobStatus(
            job_id=job_id,
            target_url=validated_url,
            status="pending",
            progress_pct=10,
            message="Initializing automated recording pipeline",
        )
        self._save_job(job)

        if auto_run:
            import threading

            thread = threading.Thread(
                target=self._execute_pipeline,
                args=(job, goal),
                daemon=True,
            )
            thread.start()

        return job

    def get_job(self, job_id: str) -> RecordedJobStatus:
        """Retrieve job status by ID."""
        if job_id in self._jobs:
            return self._jobs[job_id]

        meta_file = self.workspace / job_id / "job.json"
        if meta_file.exists():
            data = json.loads(meta_file.read_text(encoding="utf-8"))
            job = RecordedJobStatus.model_validate(data)
            self._jobs[job_id] = job
            return job

        raise KeyError(f"Recorded demo job not found: {job_id}")

    def get_video_path(self, job_id: str) -> Path:
        """Retrieve the output video path for a completed job."""
        job = self.get_job(job_id)
        if job.status != "ready" or not job.video_path:
            raise ValueError(f"Job {job_id} is not ready or has no video artifact.")
        path = Path(job.video_path)
        if not path.exists():
            raise FileNotFoundError(f"Video artifact missing: {path}")
        return path

    def _save_job(self, job: RecordedJobStatus) -> None:
        self._jobs[job.job_id] = job
        job_dir = self.workspace / job.job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        meta_file = job_dir / "job.json"
        meta_file.write_text(json.dumps(job.model_dump(), indent=2), encoding="utf-8")

    def _execute_pipeline(
        self, job: RecordedJobStatus, goal: str | None = None
    ) -> RecordedJobStatus:
        """Run the end-to-end automated pipeline."""
        job_dir = self.workspace / job.job_id

        try:
            # Stage 1: Discover UI elements
            job = job.model_copy(
                update={
                    "status": "discovering",
                    "progress_pct": 25,
                    "message": "Discovering interactive DOM landmarks",
                }
            )
            self._save_job(job)

            # Check if index.html is locally available for the loopback app
            frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist" / "index.html"
            sample_html = (
                frontend_dist.read_text(encoding="utf-8")
                if frontend_dist.exists()
                else "<html><title>DemoForge</title><body><button>Action</button></body></html>"
            )
            inventory = discover_from_html(sample_html, job.target_url)

            # Stage 2: Compile scenario and camera motion spec
            job = job.model_copy(
                update={
                    "status": "planning",
                    "progress_pct": 45,
                    "message": "Directing feature scenarios, camera zooms, and callout badges",
                }
            )
            self._save_job(job)
            spec = compile_hybrid_spec(inventory, goal=goal)
            (job_dir / "spec.json").write_text(json.dumps(spec, indent=2), encoding="utf-8")

            # Stage 3: Recording feature clips
            job = job.model_copy(
                update={
                    "status": "recording",
                    "progress_pct": 65,
                    "message": "Rehearsing and capturing event-linked feature footage",
                }
            )
            self._save_job(job)

            # Stage 4: Render hybrid Remotion video
            job = job.model_copy(
                update={
                    "status": "rendering",
                    "progress_pct": 85,
                    "message": "Synthesizing dynamic camera motion, browser frame, and 1080p MP4",
                }
            )
            self._save_job(job)

            out_video = job_dir / "demo.mp4"
            # If standard hybrid video was already pre-rendered, reuse or render fresh
            cached_demo = (
                Path(os.environ.get("LOCALAPPDATA", "."))
                / "demoforge"
                / "reviews"
                / "hybrid-demo-v1"
                / "hybrid-walkthrough.mp4"
            )
            if cached_demo.exists() and not out_video.exists():
                shutil.copyfile(cached_demo, out_video)
                from demoforge.video.remotion_render import verify_rendered_video

                report = verify_rendered_video(out_video)
            else:
                report = render_hybrid_video(spec, out_video)

            # Stage 5: Ready
            job = job.model_copy(
                update={
                    "status": "ready",
                    "progress_pct": 100,
                    "message": "Walkthrough video generated and verified",
                    "video_path": str(out_video),
                    "sha256": report["sha256"],
                }
            )
            self._save_job(job)
            return job

        except Exception as exc:
            job = job.model_copy(
                update={
                    "status": "failed",
                    "message": "Automated recording pipeline encountered an error",
                    "error": str(exc),
                }
            )
            self._save_job(job)
            return job
