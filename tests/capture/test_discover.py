"""Unit and security tests for automated app discovery."""

import pytest

from demoforge.capture.discover import (
    discover_from_html,
    is_authorized_url,
    validate_target_url,
)
from demoforge.schemas.recorded_demo import DiscoveredAppInventory


def test_authorized_url_boundaries():
    assert is_authorized_url("http://127.0.0.1:8000/")
    assert is_authorized_url("http://localhost:3000/app")
    assert is_authorized_url("http://127.0.0.1:5174/#storyboard")
    
    # Unauthorized or dangerous URLs
    assert not is_authorized_url("file:///etc/passwd")
    assert not is_authorized_url("javascript:alert(1)")
    assert not is_authorized_url("http://169.254.169.254/latest/meta-data")
    assert not is_authorized_url("http://evil.internal.network/")


def test_authorized_domains_via_env(monkeypatch):
    monkeypatch.setenv("DEMOFORGE_ALLOWED_DOMAINS", "my-app.vercel.app,example.org")
    assert is_authorized_url("https://my-app.vercel.app/dashboard")
    assert is_authorized_url("https://sub.example.org/features")
    assert not is_authorized_url("https://unauthorized-domain.com/")
    assert not is_authorized_url("http://10.0.0.1/")


def test_validate_target_url_raises_on_invalid():
    with pytest.raises(ValueError, match="authorized"):
        validate_target_url("ftp://unsupported.proto")

    assert validate_target_url("http://127.0.0.1:8000") == "http://127.0.0.1:8000/"


def test_discover_from_html_extracts_interactive_elements():
    sample_html = """
    <!DOCTYPE html>
    <html>
      <head><title>DemoForge Test Studio</title></head>
      <body>
        <nav>
          <a href="#projects">Projects</a>
          <a href="#storyboard">Storyboard</a>
        </nav>
        <main>
          <h1>Project Overview</h1>
          <button data-testid="record-btn">Record Feature</button>
          <input type="text" placeholder="Enter title" value="My Demo" />
          <button disabled>Disabled Button</button>
        </main>
      </body>
    </html>
    """
    inventory = discover_from_html(sample_html, "http://127.0.0.1:8000/")
    assert isinstance(inventory, DiscoveredAppInventory)
    assert inventory.title == "DemoForge Test Studio"
    assert len(inventory.targets) >= 3  # navigation links, heading, active button, input
    
    labels = [t.label for t in inventory.targets]
    assert "Record Feature" in labels
    assert "Storyboard" in labels
    # Disabled button should either be filtered or marked
    assert "Disabled Button" not in [t.label for t in inventory.targets if t.role == "button"]


def test_fetch_target_html_graceful_on_unreachable():
    from demoforge.capture.discover import fetch_target_html
    # Unreachable port returns None instead of raising an unhandled exception
    res = fetch_target_html("http://127.0.0.1:59999", timeout=0.2)
    assert res is None

