"""Unit tests for the Scenario and Camera Motion Compiler."""

from demoforge.capture.discover import discover_from_html
from demoforge.enrich.scenario_compiler import compile_hybrid_spec


def test_compile_hybrid_spec_from_inventory():
    html = """
    <!DOCTYPE html>
    <html>
      <head><title>TaskRoom Demo</title></head>
      <body>
        <nav><a href="#dashboard">Dashboard</a><a href="#editor">Editor</a></nav>
        <main>
          <h1>Project Tasks</h1>
          <button data-testid="filter-btn">Filter Active</button>
          <input type="text" placeholder="Search tasks..." />
          <button data-testid="export-btn">Export Video</button>
        </main>
      </body>
    </html>
    """
    inventory = discover_from_html(html, "http://127.0.0.1:8000/")
    spec = compile_hybrid_spec(inventory)
    
    assert spec["title"] == "TaskRoom Demo"
    assert spec["fps"] == 30
    assert spec["width"] == 1920
    assert spec["height"] == 1080
    assert spec["introDuration"] >= 60
    assert spec["outroDuration"] >= 60
    assert len(spec["shots"]) >= 3
    
    # Check shot properties
    for i, shot in enumerate(spec["shots"]):
      assert "id" in shot
      assert "title" in shot
      assert "caption" in shot
      assert len(shot["caption"]) <= 90
      assert "focus" in shot
      assert 0 <= shot["focus"]["x"] <= 1920
      assert 0 <= shot["focus"]["y"] <= 1080
      assert 1.0 <= shot["zoomAmount"] <= 1.4
      assert "badge" in shot
      assert shot["badge"]["text"].startswith(f"{i + 1}.")

