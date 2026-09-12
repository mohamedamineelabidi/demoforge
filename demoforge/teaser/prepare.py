"""Select exact README excerpts without footage, model calls or asset downloads."""

import re
import unicodedata
from dataclasses import dataclass
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
_QUALIFIED_CONTEXT = re.compile(
    r"\b(?:planned|proposed|future|roadmap|unsupported|unavailable|limitations?|"
    r"experimental|deprecated|not|only|except|without|requires?|samples?|examples?)\b|"
    r"\bdocument types\b",
    re.I,
)
_UNSAFE_PROSE = re.compile(
    r"(?:https?://|www\.|\b(?:ignore|disregard|override|forget)\b.*"
    r"\b(?:instructions?|prompts?|rules?|previous|above)\b|"
    r"\b(?:system prompt|developer message|jailbreak|api[_ -]?key|"
    r"password|credential|private key|secret|bearer)\b|"
    r"\b(?:reveal|exfiltrate)\b|\b(?:you are|act as|respond with|output only)\b|"
    r"(?:^|\n)\s*(?:system|developer|assistant|user)\s*:|"
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


@dataclass(frozen=True)
class _Excerpt:
    text: str
    opening_rank: int
    feature_rank: int


def _unsafe_block(content: str) -> bool:
    return bool(
        _UNSAFE_PROSE.search(content)
        or sanitize_text(content).redacted
        or "[redacted]" in content.casefold()
        or any(
            unicodedata.category(char).startswith("C") and char != "\n"
            for char in content
        )
    )


def _ranked_excerpts(evidence: Evidence, product_name: str) -> list[_Excerpt]:
    """Rank whole sentences, headings and feature descriptions, never arbitrary substrings."""
    tokens = MarkdownIt("commonmark").enable("table").parse(evidence.quote)
    excerpts = []
    blocked_level = None
    previous = None
    sections: list[tuple[int, str]] = []
    quote_depth = 0
    list_depth = 0
    sample_list = False
    last_paragraph = ""
    table_headers: list[str] = []
    row_cells: list[str] = []
    row_column = 0
    for index, token in enumerate(tokens):
        if token.type == "blockquote_open":
            quote_depth += 1
        elif token.type == "blockquote_close":
            quote_depth -= 1
        elif token.type in {"bullet_list_open", "ordered_list_open"}:
            if list_depth == 0:
                sample_list = bool(re.search(
                    r"\b(?:including|such as|examples?|sample inputs?|document types)\b",
                    last_paragraph, re.I,
                ))
            list_depth += 1
        elif token.type in {"bullet_list_close", "ordered_list_close"}:
            list_depth -= 1
        elif token.type == "table_open":
            table_headers = []
        elif token.type == "tr_open":
            row_cells = []
            row_column = 0
            for following in tokens[index + 1:]:
                if following.type == "tr_close":
                    break
                if following.type == "inline":
                    row_cells.append(following.content)
        if token.type != "inline":
            previous = token
            continue
        content = token.content.strip()
        heading = previous is not None and previous.type == "heading_open"
        table_cell = previous is not None and previous.type in {"th_open", "td_open"}
        if table_cell:
            row_column += 1
            if previous.type == "th_open":
                table_headers.append(content.casefold())
                continue
            if (
                table_headers != ["feature", "description"]
                or len(row_cells) != 2
                or row_column != 2
                or _unsafe_block(" ".join(row_cells))
                or _QUALIFIED_CONTEXT.search(row_cells[0])
            ):
                continue
        if heading:
            level = int(previous.tag[1:])
            while sections and sections[-1][0] >= level:
                sections.pop()
            sections.append((level, content))
            if blocked_level is not None and level <= blocked_level:
                blocked_level = None
            if (
                _SETUP_SECTION.search(content)
                or _QUALIFIED_CONTEXT.search(content)
                or _unsafe_block(content)
            ):
                blocked_level = level if blocked_level is None else min(level, blocked_level)
            last_paragraph = ""
        section_context = " ".join(title for _, title in sections)
        if not heading and not table_cell and not list_depth:
            last_paragraph = content
        if (
            blocked_level is not None
            or quote_depth
            or (list_depth and sample_list)
            or not token.children
            or any(child.type not in {
                "text", "softbreak", "strong_open", "strong_close", "em_open", "em_close",
            } for child in token.children)
            or _unsafe_block(content)
        ):
            continue
        display = "".join(
            "\n" if child.type == "softbreak" else child.content
            for child in token.children
        ).strip()
        candidates = [display] if heading or table_cell else re.split(
            r"(?<=[.!?])\s+(?=[A-Z])", display,
        )
        for text in candidates:
            if (
                not 1 <= len(text) <= 60
                or len(re.findall(r"[^\W\d_]+", text)) < 2
                or text.casefold().rstrip(".:") in _GENERIC
                or text.casefold() == product_name.casefold()
                or _SETUP_SECTION.search(text)
                or text not in content
                or text not in evidence.quote
            ):
                continue
            try:
                validate_teaser_text(text)
            except ValueError:
                continue
            feature_section = bool(re.search(r"\bfeatures?\b", section_context, re.I))
            purpose_section = not sections or all(
                level == 1 or title.casefold() in {"overview", "about", "description"}
                for level, title in sections
            )
            opening_rank = 100 if heading and level == 1 else 80 if purpose_section else 0
            feature_rank = 80 if feature_section else 0
            if table_cell:
                feature_rank += 10
            if re.search(r"\b(?:query|queries|questions?|answers?|search|retrieve)\b", text, re.I):
                feature_rank += 10
            if re.search(r"\bdocuments?\b", text, re.I):
                feature_rank += 5
            excerpts.append(_Excerpt(text, opening_rank, feature_rank))
    return excerpts


def _excerpts(evidence: Evidence, product_name: str) -> list[str]:
    return [excerpt.text for excerpt in _ranked_excerpts(evidence, product_name)]


def _supported_excerpts(catalog: EvidenceCatalog, product_name: str) -> dict[str, list[str]]:
    return {
        evidence.evidence_id: _excerpts(evidence, product_name)
        for evidence in _readme_evidence(catalog)
    }


def prepare_teaser(catalog: EvidenceCatalog) -> TeaserSpec:
    """Build a documented-only teaser; source text is data, never instructions."""
    product_name = _product_name(catalog)
    candidates = []
    prefix = f"{catalog.repository.repo_url}/blob/{catalog.repository.commit_sha}/"
    for evidence in _readme_evidence(catalog):
        root = "/" not in evidence.source[len(prefix):]
        for excerpt in _ranked_excerpts(evidence, product_name):
            candidates.append((evidence.evidence_id, excerpt, root))
    if len({excerpt.text.casefold() for _, excerpt, _ in candidates}) < 2:
        raise ValueError(_MISSING)
    opening = max(candidates, key=lambda item: (item[2], item[1].opening_rank))
    feature = max(
        (item for item in candidates if item[1].text.casefold() != opening[1].text.casefold()),
        key=lambda item: (item[0] == opening[0], item[2], item[1].feature_rank),
    )
    spec = TeaserSpec(
        product_name=product_name,
        repository_url=catalog.repository.repo_url,
        commit_sha=catalog.repository.commit_sha,
        catalog_sha256=artifact_hash(catalog),
        scenes=[
            TeaserScene(
                scene_id=f"teaser-{kind}", kind=kind, start_frame=start, end_frame=end,
                evidence_id=evidence_id, text=excerpt.text,
            )
            for kind, start, end, (evidence_id, excerpt, _) in [
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