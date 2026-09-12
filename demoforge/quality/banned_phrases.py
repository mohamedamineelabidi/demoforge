"""Copy lint: banned marketing phrases and em-dashes.

Used as a hard gate on every piece of generated copy (narrative, captions, slides, docs).
The phrase list lives in ``banned_phrases.txt`` next to this module so non-developers can edit it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

EM_DASH = "\u2014"
_PHRASES_FILE = Path(__file__).with_name("banned_phrases.txt")


@dataclass(frozen=True)
class Violation:
    kind: str  # "phrase" | "em_dash"
    match: str
    start: int
    end: int

    def describe(self) -> str:
        if self.kind == "em_dash":
            return f"em-dash at {self.start}: replace with a comma, colon or full stop"
        return f"banned phrase '{self.match}' at {self.start}-{self.end}"


@lru_cache(maxsize=1)
def load_banned_phrases(path: Path = _PHRASES_FILE) -> tuple[str, ...]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return tuple(ln.strip() for ln in lines if ln.strip() and not ln.lstrip().startswith("#"))


@lru_cache(maxsize=1)
def _phrase_pattern() -> re.Pattern[str]:
    # longest first so "unlock the power" wins over a shorter overlapping entry
    phrases = sorted(load_banned_phrases(), key=len, reverse=True)
    alternation = "|".join(re.escape(p).replace(r"\ ", r"\s+") for p in phrases)
    return re.compile(rf"\b(?:{alternation})\b", re.IGNORECASE)


def lint_copy(text: str) -> list[Violation]:
    """Return every violation in ``text``, ordered by position. Empty list means clean."""
    found: list[Violation] = []
    for m in _phrase_pattern().finditer(text):
        found.append(Violation("phrase", m.group(0), m.start(), m.end()))
    for i, ch in enumerate(text):
        if ch == EM_DASH:
            found.append(Violation("em_dash", ch, i, i + 1))
    return sorted(found, key=lambda v: v.start)


def assert_clean(text: str, label: str = "copy") -> None:
    """Raise ``ValueError`` listing all violations; used by generators as a gate."""
    violations = lint_copy(text)
    if violations:
        details = "; ".join(v.describe() for v in violations)
        raise ValueError(f"{label} failed copy lint: {details}")
