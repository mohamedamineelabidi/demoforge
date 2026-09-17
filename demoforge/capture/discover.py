"""Automated discovery and DOM inspection for target applications."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import urlsplit

from demoforge.schemas.recorded_demo import ActionTarget, DiscoveredAppInventory

LOOPBACK_HOSTS = {"127.0.0.1", "localhost"}


def is_authorized_url(url: str) -> bool:
    """Enforce authorized target boundaries (loopback or explicitly approved domains)."""
    try:
        parts = urlsplit(url)
    except Exception:
        return False

    if parts.scheme not in ("http", "https"):
        return False

    host = parts.hostname or ""
    # Loopback IP or localhost
    if host in LOOPBACK_HOSTS:
        return True

    # Cloud metadata or link-local addresses are forbidden
    if host.startswith("169.254.") or host.startswith("10.") or host.startswith("192.168."):
        return False

    return False


def validate_target_url(url: str) -> str:
    """Normalize and validate target application URL."""
    cleaned = url.strip()
    if not cleaned:
        raise ValueError("Target URL cannot be empty.")
    if not is_authorized_url(cleaned):
        raise ValueError(
            f"Target URL '{cleaned}' is not authorized. Must be a loopback application (e.g. http://127.0.0.1:8000)."
        )
    parts = urlsplit(cleaned)
    path = parts.path or "/"
    rebuilt = f"{parts.scheme}://{parts.netloc}{path}"
    if parts.query:
        rebuilt += f"?{parts.query}"
    if parts.fragment:
        rebuilt += f"#{parts.fragment}"
    return rebuilt


class _DOMExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = "Application Walkthrough"
        self._in_title = False
        self.targets: list[ActionTarget] = []
        self.routes: list[str] = []
        self._current_tag: str | None = None
        self._current_attrs: dict[str, str] = {}
        self._current_text: list[str] = []
        self._index = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = {k: (v or "") for k, v in attrs}
        self._current_tag = tag.lower()
        self._current_attrs = attr_dict
        self._current_text = []
        if self._current_tag == "title":
            self._in_title = True
        if tag.lower() == "a" and "href" in attr_dict:
            href = attr_dict["href"]
            if href.startswith(("#", "/")) and href not in self.routes:
                self.routes.append(href)

    def handle_endtag(self, tag: str) -> None:
        tag_lower = tag.lower()
        if tag_lower == "title":
            self._in_title = False
            title_text = "".join(self._current_text).strip()
            if title_text:
                self.title = title_text

        text = "".join(self._current_text).strip()
        attrs = self._current_attrs

        # Identify interactive targets
        role: str | None = None
        label = (
            text
            or attrs.get("placeholder", "")
            or attrs.get("aria-label", "")
            or attrs.get("value", "")
        )

        if "disabled" in attrs:
            return

        if tag_lower == "button" or attrs.get("role") == "button":
            role = "button"
        elif tag_lower == "a" and "href" in attrs:
            role = "link"
        elif tag_lower in ("input", "textarea", "select"):
            role = "input"
        elif tag_lower in ("h1", "h2", "h3"):
            role = "heading"

        if role and label:
            # Sanitize label for schema requirement: ^[^<>\x00-\x1f]+$
            clean_label = re.sub(r"[<>\x00-\x1f]", "", label).strip()
            if clean_label:
                self._index += 1
                selector = attrs.get("data-testid")
                if selector:
                    selector = f"[data-testid='{selector}']"
                elif "id" in attrs:
                    selector = f"#{attrs['id']}"
                else:
                    selector = f"{tag_lower}:text('{clean_label[:30]}')"

                # Synthetic initial bounds for layout estimation (grid 60px height)
                self.targets.append(
                    ActionTarget(
                        target_id=f"target-{self._index}",
                        selector=selector,
                        label=clean_label[:80],
                        role=role,
                        x=120.0,
                        y=float(80 + (self._index * 65)),
                        width=240.0,
                        height=44.0,
                    )
                )

    def handle_data(self, data: str) -> None:
        self._current_text.append(data)


def discover_from_html(html_content: str, url: str) -> DiscoveredAppInventory:
    """Parse HTML and extract interactive landmarks and routes deterministically."""
    parser = _DOMExtractor()
    parser.feed(html_content)
    # Sanitize title for schema requirement: ^[^<>\x00-\x1f]+$
    clean_title = re.sub(r"[<>\x00-\x1f]", "", parser.title).strip() or "Application Walkthrough"
    return DiscoveredAppInventory(
        url=url,
        title=clean_title,
        targets=tuple(parser.targets),
        routes=tuple(parser.routes) if parser.routes else ("/",),
    )

