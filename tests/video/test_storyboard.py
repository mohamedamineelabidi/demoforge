from datetime import UTC, datetime

import pytest

from demoforge.ingest.github import Snapshot, SourceFile
from demoforge.pack.context_pack import assemble_context
from demoforge.video.storyboard import Caption, Proposal, Scene, Storyboard, validate_grounding


def catalog():
    return assemble_context(
        Snapshot(
            "https://github.com/owner/repo",
            "owner/repo",
            "a" * 40,
            (SourceFile("README.md", b"Filter tasks.\nShow completed tasks.\nReview results."),),
            0,
        ),
        now=datetime(2026, 9, 12, tzinfo=UTC),
    ).catalog


def proposal():
    return Proposal(
        proposal_id="proposal-1",
        revision=1,
        catalog_sha256="c" * 64,
        captions=[
            Caption(
                claim_id=f"claim-{index}", text=text, evidence_id="source-0", status="documented"
            )
            for index, text in enumerate(
                ["Filter tasks.", "Show completed tasks.", "Review results."]
            )
        ],
    )


def test_exact_supported_captions_are_accepted():
    validate_grounding(proposal(), catalog())


@pytest.mark.parametrize(
    "change",
    [{"text": "Invented feature."}, {"evidence_id": "missing"}, {"status": "runtime_observed"}],
)
def test_fabricated_or_upgraded_caption_is_rejected(change):
    value = proposal().model_dump()
    value["captions"][0].update(change)
    with pytest.raises(ValueError):
        validate_grounding(Proposal.model_validate(value), catalog())


def test_storyboard_requires_contiguity_total_and_source_bounds():
    scenes = [
        Scene(start_frame=start, end_frame=end, source_in=start, caption=caption)
        for (start, end), caption in zip(
            [(0, 180), (180, 660), (660, 900)], proposal().captions, strict=True
        )
    ]
    data = dict(
        storyboard_id="storyboard-1",
        revision=1,
        proposal_sha256="b" * 64,
        media_sha256="d" * 64,
        media_frames=900,
        scenes=scenes,
    )
    storyboard = Storyboard(**data)
    assert storyboard.fps == 30
    assert storyboard.scenes[-1].end_frame == 900
    for field, value in [("source_in", 899), ("start_frame", 1), ("end_frame", 179)]:
        broken = storyboard.model_dump()
        broken["scenes"][0][field] = value
        with pytest.raises(ValueError):
            Storyboard.model_validate(broken)


def test_caption_limits_and_copy_lint():
    for text in ["x" * 61, "A seamless workflow.", "One\nTwo"]:
        with pytest.raises(ValueError):
            Caption(claim_id="claim", text=text, evidence_id="source-0", status="documented")


def test_render_inputs_require_exact_approvals_and_catalog():
    from demoforge.schemas.approval import Approval
    from demoforge.video.storyboard import Scenario, artifact_hash, validate_render_inputs

    source = catalog()
    proposed = proposal().model_copy(update={"catalog_sha256": artifact_hash(source)})
    scenario = Scenario(
        scenario_id="scenario",
        revision=1,
        proposal_sha256=artifact_hash(proposed),
        media_sha256="d" * 64,
        source_in=[0, 180, 660],
    )
    board = Storyboard(
        storyboard_id="board",
        revision=1,
        proposal_sha256=artifact_hash(proposed),
        media_sha256="d" * 64,
        media_frames=900,
        scenes=[
            Scene(start_frame=start, end_frame=end, source_in=start, caption=caption)
            for (start, end), caption in zip(
                [(0, 180), (180, 660), (660, 900)], proposed.captions, strict=True
            )
        ],
    )
    approvals = [
        Approval(
            schema_version=1,
            approval_id=kind,
            run_id="run",
            subject_type=kind,
            subject_id=identity,
            subject_revision=1,
            subject_sha256=artifact_hash(subject),
            actor_id="test-operator",
            decision="approved",
            decided_at=datetime(2026, 9, 12, tzinfo=UTC),
            note="Synthetic test decision, not a human review",
        )
        for kind, identity, subject in [
            ("claims", proposed.proposal_id, proposed),
            ("scenario", scenario.scenario_id, scenario),
            ("storyboard", board.storyboard_id, board),
        ]
    ]
    validate_render_inputs("run", source, proposed, scenario, board, approvals)
    with pytest.raises(ValueError, match="approval"):
        validate_render_inputs("different-run", source, proposed, scenario, board, approvals)
    with pytest.raises(ValueError, match="approval"):
        validate_render_inputs("run", source, proposed, scenario, board, approvals[:-1])
    changed = board.model_copy(update={"revision": 2})
    with pytest.raises(ValueError, match="approval"):
        validate_render_inputs("run", source, proposed, scenario, changed, approvals)
