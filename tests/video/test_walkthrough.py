"""Checks for the owned-app recording proof, not an arbitrary-URL capture service."""

import json
import os
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("walkthrough.mjs")


def test_walkthrough_camera_and_scope_contract():
    script = r"""
import assert from 'node:assert/strict';
const {cameraAt, validateEdit, makeEdit, pointerPath, videoFilter} = await import(process.argv[1]);
const edit = makeEdit();
assert.equal(edit.style, 'edge-to-edge');
const movement = pointerPath({x:100,y:100}, {x:1100,y:600});
assert.equal(movement.length, 61);
assert.equal(movement[0].time, 0);
assert.equal(movement.at(-1).time, 1000);
assert.equal(movement.at(-1).x, 1100);
assert.ok(movement.slice(1).every((point, index) => point.time > movement[index].time));
assert.ok(movement.slice(1).every((point, index) => Math.abs(point.x - movement[index].x) < 32));
const filter = videoFilter(edit.shots[0]);
assert.doesNotMatch(filter, /(?:^|,)pad=|overlay=/);
assert.match(filter, /scale=3840:2160/);
assert.match(filter, /s=1920x1080/);
assert.equal(edit.shots.length, 8);
assert.equal(edit.shots.reduce((total, shot) => total + shot.frames, 0), 1800);
assert.equal(edit.human_approved, false);
assert.equal(edit.scope, 'owned-demoforge-fixture');
for (const focus of [{x:0,y:0},{x:1280,y:720},{x:1120,y:560}]) {
 for (let frame = 0; frame < 225; frame++) {
  const camera = cameraAt(frame, 225, focus);
    assert.ok(camera.zoom >= 1 && camera.zoom <= 1.2);
  assert.ok(camera.x >= 0 && camera.y >= 0);
  assert.ok(camera.x + 1280 / camera.zoom <= 1280.001);
    assert.ok(camera.y + 720 / camera.zoom <= 720.001);
 }
 assert.equal(cameraAt(0,225,focus).zoom, 1);
 assert.equal(cameraAt(224,225,focus).zoom, 1);
}
assert.deepEqual(cameraAt(95,225,{x:900,y:500}), cameraAt(95,225,{x:900,y:500}));
assert.throws(() => cameraAt(-1,225,{x:100,y:100}));
assert.throws(() => cameraAt(1,225,{x:NaN,y:100}));
validateEdit(edit);
for (const mutate of [
 value => value.url = 'https://example.com',
 value => value.url = 'http://127.0.0.1:8001.evil.test',
 value => value.shots[0].source = '../private.webm',
 value => value.shots[0].source_in = -1,
 value => value.shots[0].focus.x = 9000,
 value => value.shots[0].frames = 0,
 value => value.shots[0].title = '<script>fake</script>',
 value => value.human_approved = true
]) {
 const invalid = structuredClone(edit);
 mutate(invalid);
 assert.throws(() => validateEdit(invalid));
}
"""
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script, SCRIPT.resolve().as_uri()],
        capture_output=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stdout.decode() + result.stderr.decode()


@pytest.mark.skipif(
    os.environ.get("DEMOFORGE_WALKTHROUGH") != "1",
    reason="owned-app foreground recording is opt-in",
)
def test_record_and_edit_owned_app(tmp_path):
    folder = Path(os.environ.get("DEMOFORGE_WALKTHROUGH_OUTPUT", str(tmp_path / "tour")))
    result = subprocess.run(
        ["node", str(SCRIPT), "--capture", str(folder)],
        capture_output=True, timeout=1200, check=False,
    )
    assert result.returncode == 0, result.stdout.decode() + result.stderr.decode()
    measurements = json.loads((folder / "measurements.json").read_text(encoding="utf-8"))
    assert measurements["frame_count"] == 1800
    assert measurements["duration_seconds"] == 60
    assert measurements["full_decode"] == "passed"
    assert measurements["has_audio"] is False
    assert measurements["human_review"] == "pending"
    assert measurements["style"] == "edge-to-edge"
    assert measurements["pointer_timing"] == "passed"
    assert len(measurements["sha256"]) == 64
    assert len(measurements["shots"]) == 8
    assert all(shot["observed"] for shot in measurements["shots"])