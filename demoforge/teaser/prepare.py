"""Select exact README excerpts without footage, model calls or asset downloads."""

import re
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

from markdown_it import MarkdownIt

from demoforge.quality.secrets import sanitize_text
from demoforge.schemas._base import validate_relative_path
from demoforge.schemas.claim import EvidenceCatalog
from demoforge.schemas.evidence import Evidence
from demoforge.schemas.teaser import TeaserScene, TeaserSpec, validate_teaser_text
from demoforge.video.storyboard import artifact_hash

_SETUP_SECTION = re.compile(
    r"\b(?:install(?:ation|ing)?|setup|getting started|quick ?start|usage|"
    r"requirements|dependencies|prerequisites|configuration|deployment|"
    r"table of contents|navigation|license|contribut(?:e|ing|ion)|"
    r"changelog|release notes|credits|acknowledg(?:e)?ments|support|contact)\b",
    re.I,
)
_GENERIC = {
    "features", "key features", "overview", "description", "about", "documentation",
    "readme", "contents", "project overview", "links", "badges", "status",
    "demo", "demo video", "video demo", "watch demo", "screenshots", "screen shots",
}
_UNSAFE_PROSE = re.compile(
    r"(?:https?://|www\.|\b(?:ignore|disregard|override|forget)\b.*"
    r"\b(?:instructions?|prompts?|rules?|previous|above)\b|"
    r"\b(?:system prompt|developer message|assistant|jailbreak|api[_ -]?key|"
    r"password|credential|private key|secret|bearer)\b|"
    r"\b(?:reveal|exfiltrate)\b|"
    r"^(?:npm|npx|pip|uv|git|curl|wget|sudo|docker|python|node|cd|export)\s|"
    r"^(?:version|author|license|build|status)\s*[:=]|[=$])",
    re.I,
)
_MISSING = (
    "README documentation needs at least two distinct clean product descriptions or feature "
    "excerpts of 2 or more words and at most 60 characters. Add short plain-text sentences "
    "or meaningful headings to the README, then ingest the pinned revision again."
)


def _product_name(catalog: EvidenceCatalog) -> str:
    repository = catalog.repository
    match = re.fullmatch(
        r"https://github\.com/([A-Za-z0-9][A-Za-z0-9-]*)/([A-Za-z0-9][A-Za-z0-9._-]*)",
        repository.repo_url,
    )
    if match is None or repository.full_name != f"{match[1]}/{match[2]}":
        raise ValueError("repository identity must match its canonical public GitHub URL")
    name = match[2]
    if len(name) > 60 or sanitize_text(name).redacted:
        raise ValueError("repository name must be safe display text of at most 60 characters")
    return name


def _readme_evidence(catalog: EvidenceCatalog) -> list[Evidence]:
    prefix = f"{catalog.repository.repo_url}/blob/{catalog.repository.commit_sha}/"
    records = {record.path: record for record in catalog.files}
    eligible = []
    for evidence in catalog.evidence:
        if (
            evidence.kind != "repository"
            or evidence.revision != catalog.repository.commit_sha
            or not evidence.source.startswith(prefix)
        ):
            continue
        path = evidence.source[len(prefix):]
        parsed = urlsplit(evidence.source)
        if parsed.query or parsed.fragment or unquote(path) != path:
            continue
        try:
            validate_relative_path(path)
        except ValueError:
            continue
        record = records.get(path)
        if (
            record is None
            or record.classification != "readme"
            or record.scan_status not in {"clean", "redacted"}
            or record.exclusion_reason is not None
            or record.content_sha256 != evidence.content_sha256
            or PurePosixPath(path).name.casefold() not in {"readme", "readme.md", "readme.markdown"}
            or sanitize_text(evidence.quote).redacted
        ):
            continue
        eligible.append(evidence)
    return sorted(eligible, key=lambda item: (item.source, item.line_start or 0, item.evidence_id))


def _excerpts(evidence: Evidence, product_name: str) -> list[str]:
    """Keep whole plain blocks/sentences, including original terminal punctuation."""
    tokens = MarkdownIt("commonmark").parse(evidence.quote)
    excerpts = []
    blocked_level = None
    previous = None
    for token in tokens:
        if token.type != "inline":
            previous = token
            continue
        content = token.content.strip()
        heading = previous is not None and previous.type == "heading_open"
        if heading:
            level = int(previous.tag[1:])
            if blocked_level is not None and level <= blocked_level:
                blocked_level = None
            if _SETUP_SECTION.search(content):
                blocked_level = level if blocked_level is None else min(level, blocked_level)
        if (
            blocked_level is not None
            or not token.children
            or any(child.type not in {"text", "softbreak"} for child in token.children)
            or _UNSAFE_PROSE.search(content)
            or sanitize_text(content).redacted
            or "[redacted]" in content.casefold()
        ):
            continue
        try:
            validate_teaser_text(content.replace("\n", " "))
        except ValueError:
            continue
        for line in content.splitlines():
            candidates = [line.strip()]
            if not heading:
                candidates = re.split(r"(?<=[.!?]) +(?=[A-Z])", line.strip())
            for text in candidates:
                if (
                    not 1 <= len(text) <= 60
                    or len(re.findall(r"[^\W\d_]+", text)) < 2
                    or text.casefold().rstrip(".:") in _GENERIC
                    or text.casefold() == product_name.casefold()
                    or _SETUP_SECTION.search(text)
                    or text not in evidence.quote
                ):
                    continue
                try:
                    validate_teaser_text(text)
                except ValueError:
                    continue
                if text not in excerpts:
                    excerpts.append(text)
    return excerpts


def _supported_excerpts(catalog: EvidenceCatalog, product_name: str) -> dict[str, list[str]]:
    return {
        evidence.evidence_id: _excerpts(evidence, product_name)
        for evidence in _readme_evidence(catalog)
    }


def prepare_teaser(catalog: EvidenceCatalog) -> TeaserSpec:
    """Build a documented-only teaser; source text is data, never instructions."""
    product_name = _product_name(catalog)
    supported = _supported_excerpts(catalog, product_name)
    candidates = []
    seen = set()
    for evidence_id, texts in supported.items():
        for text in texts:
            if text.casefold() not in seen:
                candidates.append((evidence_id, text))
                seen.add(text.casefold())
    if len(candidates) < 2:
        raise ValueError(_MISSING)
    opening, feature = candidates[:2]
    spec = TeaserSpec(
        product_name=product_name,
        repository_url=catalog.repository.repo_url,
        commit_sha=catalog.repository.commit_sha,
        catalog_sha256=artifact_hash(catalog),
        scenes=[
            TeaserScene(
                scene_id=f"teaser-{kind}", kind=kind, start_frame=start, end_frame=end,
                evidence_id=evidence_id, text=text,
            )
            for kind, start, end, (evidence_id, text) in [
                ("title", 0, 180, opening),
                ("feature", 180, 660, feature),
                ("end", 660, 900, opening),
            ]
        ],
    )
    validate_teaser(spec, catalog)
    return spec


def validate_teaser(spec: TeaserSpec, catalog: EvidenceCatalog) -> None:
    """Recheck mutable structure, exact catalog identity and complete supported excerpts."""
    checked = TeaserSpec.model_validate(spec.model_dump())
    if checked.catalog_sha256 != artifact_hash(catalog):
        raise ValueError("teaser catalog hash mismatch; prepare from the current catalog")
    if (
        checked.commit_sha != catalog.repository.commit_sha
        or checked.repository_url != catalog.repository.repo_url
        or checked.product_name != _product_name(catalog)
    ):
        raise ValueError("teaser repository, commit or product identity mismatch")
    supported = _supported_excerpts(catalog, checked.product_name)
    for scene in checked.scenes:
        if scene.text not in supported.get(scene.evidence_id, []):
            raise ValueError(
                "scene text must be a complete clean README excerpt with its original "
                "punctuation, supported by scanned repository evidence at this commit"
            )