"""Conservative local redaction rules; not a guarantee that all private data is detected."""

import re
from dataclasses import dataclass

_ASSIGNMENT = re.compile(
    r"""(?im)(["']?[\w.-]*(?:token|password|passwd|secret|api[_-]?key|credential)[\w.-]*"""
    r"""["']?[ \t]*[:=][ \t]*)("[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}\r\n]+)"""
)
_TOKEN = re.compile(
    r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|"
    r"sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b"
)
_AUTH = re.compile(r"(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+")
_URL_AUTH = re.compile(r"(https?://)[^\s/@:]+:[^\s/@]+@", re.I)
_PRIVATE_KEY = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S
)


@dataclass(frozen=True)
class SanitizedText:
    text: str
    redacted: bool


def sanitize_text(text: str, *, environment_template: bool = False) -> SanitizedText:
    if environment_template:
        lines = []
        for line in text.splitlines(keepends=True):
            ending = "\n" if line.endswith("\n") else ""
            match = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
            lines.append((f"{match[1]}=" if match else "") + ending)
        cleaned = "".join(lines)
    else:
        cleaned = _PRIVATE_KEY.sub(
            lambda match: "\n".join("[REDACTED]" for _ in match[0].splitlines()), text
        )
        cleaned = _ASSIGNMENT.sub(lambda match: match[1] + '"[REDACTED]"', cleaned)
        cleaned = _TOKEN.sub("[REDACTED]", cleaned)
        cleaned = _AUTH.sub(lambda match: match[1] + " [REDACTED]", cleaned)
        cleaned = _URL_AUTH.sub(r"\1[REDACTED]@", cleaned)
    return SanitizedText(cleaned, cleaned != text)
