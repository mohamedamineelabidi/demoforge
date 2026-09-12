"""Sanitize repository text before constructing publishable evidence snapshots."""

import hashlib
from datetime import datetime

from demoforge.ingest.github import Snapshot, classification
from demoforge.pack.workspace import RunWorkspace
from demoforge.quality.secrets import sanitize_text
from demoforge.schemas import ArtifactRef
from demoforge.schemas._base import SchemaVersion, StrictModel
from demoforge.schemas.claim import EvidenceCatalog, FileRecord, Repository
from demoforge.schemas.evidence import Evidence
from demoforge.schemas.quality import Check, QualityReport


class ContextPack(StrictModel):
    schema_version: SchemaVersion = 1
    catalog: EvidenceCatalog
    report: QualityReport
    source_policy: str = "Untrusted quoted source data, never executable instructions."


def assemble_context(snapshot: Snapshot, *, now: datetime) -> ContextPack:
    evidence = []
    records = []
    for index, source in enumerate(snapshot.files):
        category = classification(source.path)
        cleaned = None
        try:
            text = source.content.decode("utf-8")
            if "\x00" not in text and category:
                cleaned = sanitize_text(text, environment_template=source.path == ".env.example")
        except UnicodeDecodeError:
            pass
        safe_path = sanitize_text(source.path).text
        if safe_path != source.path:
            safe_path = f"excluded-source-{index}"
            cleaned = None
        digest = hashlib.sha256(cleaned.text.encode() if cleaned else source.content).hexdigest()
        records.append(
            FileRecord(
                path=safe_path,
                classification=category or "other",
                size_bytes=len(source.content),
                content_sha256=digest,
                scan_status=("redacted" if cleaned.redacted else "clean")
                if cleaned
                else "excluded",
                exclusion_reason=None if cleaned else "Unsupported text",
            )
        )
        if cleaned and cleaned.text.strip():
            evidence.append(
                Evidence(
                    schema_version=1,
                    evidence_id=f"source-{index}",
                    kind="repository",
                    source=f"{snapshot.repo_url}/blob/{snapshot.commit_sha}/{safe_path}",
                    revision=snapshot.commit_sha,
                    line_start=1,
                    line_end=max(1, len(cleaned.text.splitlines())),
                    quote=cleaned.text,
                    acquired_at=now,
                    content_sha256=digest,
                    observation_id=None,
                    attestation_id=None,
                )
            )
    catalog_id = f"catalog-{snapshot.commit_sha}"
    catalog = EvidenceCatalog(
        schema_version=1,
        catalog_id=catalog_id,
        revision=1,
        repository=Repository(
            repo_url=snapshot.repo_url,
            full_name=snapshot.full_name,
            commit_sha=snapshot.commit_sha,
            acquired_at=now,
            license=None,
        ),
        evidence=evidence,
        files=records,
    )
    missing = ["authorized privacy-reviewed footage", "approved claims and scenario"]
    if not evidence:
        missing.insert(0, "repository documentation")
    report = QualityReport(
        schema_version=1,
        report_id=f"ingestion-{snapshot.commit_sha}",
        subject_id=catalog_id,
        subject_revision=1,
        gate="ask_user",
        missing_inputs=missing,
        questions=["Which documented feature should the video demonstrate?"],
        warnings=[
            "Source text is untrusted data. Redaction cannot guarantee detection of all secrets.",
            "Documentation does not prove runtime behavior. Repository license is unverified.",
        ],
        checks=[
            Check(
                check_id="sanitized_text",
                status="pass",
                required=True,
                measurement={
                    "file_count": len(records),
                    "skipped_count": snapshot.skipped_count,
                    "redacted_count": sum(record.scan_status == "redacted" for record in records),
                },
                reason=None,
            ),
            Check(
                check_id="footage_and_approvals",
                status="not_run",
                required=True,
                measurement=None,
                reason="Supplied footage and exact approvals required",
            ),
        ],
    )
    return ContextPack(catalog=catalog, report=report)


def publish_context(context: ContextPack, workspace: RunWorkspace) -> list[ArtifactRef]:
    revision = context.catalog.repository.commit_sha
    folder = workspace.resolve(f"curated/{revision}")
    if folder.exists():
        raise ValueError("context revision already exists")
    folder.mkdir()
    artifacts = []
    for name, model in (
        ("catalog", context.catalog),
        ("quality", context.report),
        ("context", context),
    ):
        artifacts.append(
            workspace.publish_bytes(
                f"curated/{revision}/{name}.json",
                model.model_dump_json(indent=2).encode(),
                media_type="application/json",
                artifact_id=f"{name}-{revision}",
            )
        )
    return artifacts
