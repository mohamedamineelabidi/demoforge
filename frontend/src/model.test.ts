import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createProject,
  editScene,
  moveScene,
  parseProjects,
  timeline,
  undo,
  redo,
  updateProject,
  recordApproval,
} from "./model";
import { createApproval } from "./approvals/schema";
import styleProfile from "../../references/style_analysis/style_profile.json";
import { MOTION_CAPTION_MAX, MOTION_MAX_SCALE } from "./motion/motion";
import { lintBrief, MARKETING_WORDS } from "./entry/schemas";
import { FrameStoryboard } from "./storyboard/FrameStoryboard";
import {
  captionErrors,
  compareStoryboard,
  editCaption,
  setSceneEndFrame,
  timeline30fps,
} from "./storyboard/model";

describe("local storyboard drafts", () => {
  it("persists local approval metadata without editing the approved revision", () => {
    const project = createProject("Review draft");
    const approval = createApproval({ run_id: `local:${project.id}`, subject_type: "storyboard",
      subject_id: `local:${project.id}:storyboard`, subject_revision: project.revision,
      subject_sha256: "a".repeat(64), actor_id: "Operator", decision: "approved", note: null });
    const recorded = recordApproval(project, approval);
    expect(recorded.revision).toBe(project.revision);
    expect(recorded.past).toEqual(project.past);
    expect(recorded.approvalDrafts).toEqual([approval]);
    expect(recorded.storyboardReview?.scenes).toEqual(project.scenes);
    expect(parseProjects(JSON.stringify({ version: 1, projects: [recorded] }))[0]).toEqual(recorded);
    expect(recordApproval(recorded, approval)).toBe(recorded);
    const edited = editScene(recorded, project.scenes[0].id, { caption: "Changed caption" });
    expect(edited.storyboardReview?.scenes[0].caption).toBe("");
    expect(edited.approvalDrafts).toEqual([approval]);
    expect(undo(edited).approvalDrafts).toEqual([approval]);
  });
  it("rejects cross-project and stale storyboard decisions and retains immutable history", () => {
    const project = createProject("Review draft");
    const approval = createApproval({ run_id: `local:${project.id}`, subject_type: "storyboard",
      subject_id: `local:${project.id}:storyboard`, subject_revision: project.revision,
      subject_sha256: "a".repeat(64), actor_id: "Operator", decision: "approved", note: null });
    expect(() => recordApproval(project, { ...approval, run_id: "another-run" })).toThrow();
    expect(() => recordApproval(project, { ...approval, subject_revision: 99 })).toThrow();
    const recorded = recordApproval(project, approval);
    expect(() => recordApproval(recorded, { ...approval, note: "rewritten" })).toThrow();
    const rejected = recordApproval(recorded, createApproval({ ...approval, decision: "rejected", note: "Caption needs revision" }));
    expect(rejected.approvalDrafts).toHaveLength(2);
    expect(rejected.storyboardReview).toEqual(recorded.storyboardReview);
  });
  it("starts with three contiguous scenes totaling 900 frames", () => {
    const project = createProject("Release demo");
    expect(
      timeline(project.scenes).map((scene) => [scene.start, scene.end]),
    ).toEqual([
      [0, 180],
      [180, 660],
      [660, 900],
    ]);
    expect(project.revision).toBe(1);
  });
  it("increments draft revision, preserving source references", () => {
    const project = createProject("Demo", true);
    const edited = editScene(project, project.scenes[0].id, {
      caption: "A clearer starting point",
    });
    expect(edited.revision).toBe(2);
    expect(edited.scenes[0].claimId).toBe(project.scenes[0].claimId);
    expect(project.scenes[0].caption).not.toBe(edited.scenes[0].caption);
  });
  it("rejects invalid frame counts, fractional trims and out-of-bounds zoom", () => {
    const project = createProject("Demo");
    for (const patch of [
      { frames: 0 },
      { frames: 1.2 },
      { trimIn: -1 },
      { trimIn: 2.5 },
      { zoom: 3 },
    ]) {
      expect(() => editScene(project, project.scenes[0].id, patch)).toThrow();
    }
  });
  it("reorders without dropping scenes and supports undo/redo", () => {
    const project = createProject("Demo");
    const moved = moveScene(project, project.scenes[1].id, -1);
    expect(moved.scenes[0].id).toBe(project.scenes[1].id);
    const reverted = undo(moved);
    expect(reverted.scenes).toEqual(project.scenes);
    expect(redo(reverted).scenes).toEqual(moved.scenes);
    expect(moveScene(project, project.scenes[0].id, -1)).toEqual(project);
  });
  it("round trips drafts and rejects corrupted or future storage versions", () => {
    const projects = [createProject("Demo")];
    expect(parseProjects(JSON.stringify({ version: 1, projects }))).toEqual(
      projects,
    );
    expect(() => parseProjects("{")).toThrow();
    expect(() => parseProjects('{"version":2,"projects":[]}')).toThrow();
    expect(() =>
      parseProjects('{"version":1,"projects":[{"name":"bad"}]}'),
    ).toThrow();
  });
  it("never persists local media URLs or authoritative approval fields", () => {
    const project = {
      ...createProject("Demo"),
      approved: true,
      mediaUrl: "blob:private",
    };
    const parsed = parseProjects(
      JSON.stringify({ version: 1, projects: [project] }),
    );
    expect(parsed[0]).not.toHaveProperty("approved");
    expect(parsed[0]).not.toHaveProperty("mediaUrl");
  });

  it("defaults new scene fields in v1 drafts and both history directions", () => {
    const original = createProject("Legacy");
    const edited = editScene(original, original.scenes[0].id, { caption: "Changed" });
    const legacy = JSON.stringify({ version: 1, projects: [undo(edited), edited] },
      (key, value) => key === "highlight" || key === "footageClipRef" ? undefined : value);
    const parsed = parseProjects(legacy);
    for (const project of parsed) {
      for (const scenes of [project.scenes, ...project.past.map((item) => item.scenes),
        ...project.future.map((item) => item.scenes)]) {
        expect(scenes.every((scene) => scene.highlight === "none" && scene.footageClipRef === ""))
          .toBe(true);
      }
    }
    expect(redo(parsed[0]).scenes).toEqual(parsed[1].scenes);
  });

  it("validates highlight and bounds a plain clip reference without interpreting it", () => {
    const project = createProject("Demo");
    for (const highlight of ["none", "zoom", "box", "spotlight", "caret"] as const) {
      const edited = editScene(project, project.scenes[0].id, {
        highlight, footageClipRef: "https://example.invalid/clip.mp4", zoom: 1.5,
      });
      expect(edited.scenes[0].highlight).toBe(highlight);
      expect(edited.scenes[0].footageClipRef).toBe("https://example.invalid/clip.mp4");
      expect(edited.scenes[0].zoom).toBe(1.5);
    }
    const raw = JSON.parse(JSON.stringify({ version: 1, projects: [project] }));
    raw.projects[0].scenes[0].highlight = "glow";
    expect(() => parseProjects(JSON.stringify(raw))).toThrow();
    expect(() => editScene(project, project.scenes[0].id, { footageClipRef: "x".repeat(501) }))
      .toThrow();
    expect(editScene(project, project.scenes[0].id, { footageClipRef: "x".repeat(500) })
      .scenes[0].footageClipRef).toHaveLength(500);
  });

  it("does not create history or revisions for normalized no-op edits", () => {
    const project = createProject("Demo");
    expect(updateProject(project, {})).toBe(project);
    expect(updateProject(project, { name: " Demo " })).toBe(project);
    expect(editScene(project, project.scenes[0].id, { ...project.scenes[0] })).toBe(project);
    expect(updateProject(project, { scenes: structuredClone(project.scenes) })).toBe(project);
    const reverted = undo(editScene(project, project.scenes[0].id, { caption: "New" }));
    expect(editScene(reverted, reverted.scenes[0].id, { caption: reverted.scenes[0].caption }))
      .toBe(reverted);
    expect(reverted.future).toHaveLength(1);
  });
});

describe("frame storyboard helpers", () => {
  it("matches the shared style profile while preserving legacy captions", () => {
    const project = createProject("Style profile");
    const sequence = timeline30fps(project.scenes);
    expect(sequence.fps).toBe(styleProfile.fps);
    expect(sequence.totalFrames).toBe(styleProfile.target_duration_frames);
    expect(sequence.scenes.map(scene => [scene.start_frame, scene.end_frame])).toEqual(styleProfile.beats.map(beat => beat.frames));
    expect(MOTION_CAPTION_MAX).toBe(styleProfile.captions.max_chars);
    expect(MOTION_MAX_SCALE).toBe(styleProfile.transitions.push_in_max_scale);
    expect(captionErrors("x".repeat(60))).toEqual([]);
    expect(captionErrors("x".repeat(61))).not.toEqual([]);
    project.scenes[0].caption = "x".repeat(160);
    expect(parseProjects(JSON.stringify({ version: 1, projects: [project] }))[0].scenes[0].caption).toHaveLength(160);
  });
  it("exposes half-open frame ranges and an honest 900-frame target", () => {
    const project = createProject("Demo");
    expect(timeline30fps(project.scenes)).toMatchObject({
      fps: 30, targetFrames: 900, totalFrames: 900, matchesTarget: true,
      scenes: [{ start_frame: 0, end_frame: 180 },
        { start_frame: 180, end_frame: 660 }, { start_frame: 660, end_frame: 900 }],
    });
    const edited = setSceneEndFrame(project, project.scenes[1].id, 700);
    expect(timeline30fps(edited.scenes)).toMatchObject({
      totalFrames: 940, matchesTarget: false,
      scenes: [{ start_frame: 0, end_frame: 180 },
        { start_frame: 180, end_frame: 700 }, { start_frame: 700, end_frame: 940 }],
    });
    expect(edited.scenes.map((scene) => scene.trimIn)).toEqual([0, 180, 660]);
    expect(undo(edited).scenes).toEqual(project.scenes);
    expect(setSceneEndFrame(project, project.scenes[1].id, 660)).toBe(project);
  });

  it("rejects invalid ends and accepts durations from 1 through 1800 frames", () => {
    const project = createProject("Demo");
    for (const end of [180, 179, 180.5, 1981, NaN, Infinity]) {
      expect(() => setSceneEndFrame(project, project.scenes[1].id, end)).toThrow();
    }
    for (const frames of [1, 1800]) {
      expect(setSceneEndFrame(project, project.scenes[1].id, 180 + frames).scenes[1].frames)
        .toBe(frames);
    }
    expect(() => setSceneEndFrame(project, "missing", 200)).toThrow();
  });

  it("reuses entry copy lint and rejects invalid caption saves without invalidating legacy drafts", () => {
    const project = createProject("Demo");
    for (const caption of ["Filter\u2014completed tasks", ...MARKETING_WORDS]) {
      expect(captionErrors(caption)).toEqual(lintBrief(caption).map((issue) => issue.message));
      expect(() => editCaption(project, project.scenes[0].id, caption)).toThrow();
    }
    expect(captionErrors("x".repeat(161))).not.toEqual([]);
    expect(() => editCaption(project, project.scenes[0].id, "x".repeat(161))).toThrow();
    expect(captionErrors("Filter completed tasks.")).toEqual([]);
    expect(editCaption(project, project.scenes[0].id, "")).toBe(project);
    const edited = editCaption(project, project.scenes[0].id, "Filter completed tasks.");
    expect(edited.past).toHaveLength(1);
    expect(undo(edited).scenes).toEqual(project.scenes);
    const legacy = editScene(project, project.scenes[0].id, { caption: "Seamless\u2014filter" });
    expect(parseProjects(JSON.stringify({ version: 1, projects: [legacy] }))[0].scenes)
      .toEqual(legacy.scenes);
  });

  it("compares a local baseline without inventing approval when it is absent", () => {
    const project = createProject("Demo");
    expect(compareStoryboard(project.scenes)).toMatchObject({ hasBaseline: false, changed: false });
    expect(compareStoryboard(project.scenes, structuredClone(project.scenes)))
      .toMatchObject({ hasBaseline: true, changed: false, removedSceneIds: [] });
    const edited = editCaption(project, project.scenes[0].id, "Filter completed tasks.");
    const comparison = compareStoryboard(edited.scenes, project.scenes);
    expect(comparison.changed).toBe(true);
    expect(comparison.scenes[0]).toEqual({
      sceneId: project.scenes[0].id, captionChanged: true, structureChanged: false,
    });
    expect(compareStoryboard(undo(edited).scenes, project.scenes).changed).toBe(false);
  });

  it("detects structural edits, shifts, order, added scenes and removed scenes", () => {
    const project = createProject("Demo");
    for (const patch of [{ title: "Result" }, { trimIn: 2 }, { zoom: 1.2 },
      { highlight: "box" as const }, { footageClipRef: "clip-1" }, { claimId: "claim-1" }]) {
      const edited = editScene(project, project.scenes[0].id, patch);
      expect(compareStoryboard(edited.scenes, project.scenes).scenes[0])
        .toMatchObject({ captionChanged: false, structureChanged: true });
    }
    const resized = setSceneEndFrame(project, project.scenes[0].id, 181);
    expect(compareStoryboard(resized.scenes, project.scenes).scenes
      .every((scene) => scene.structureChanged)).toBe(true);
    const moved = moveScene(project, project.scenes[0].id, 1);
    expect(compareStoryboard(moved.scenes, project.scenes).changed).toBe(true);
    const removed = compareStoryboard(project.scenes.slice(1), project.scenes);
    expect(removed.removedSceneIds).toEqual([project.scenes[0].id]);
    expect(removed.changed).toBe(true);
    expect(compareStoryboard(project.scenes, []).scenes.every((scene) => scene.structureChanged))
      .toBe(true);
    const lastRemoved = compareStoryboard(project.scenes.slice(0, -1), project.scenes);
    expect(lastRemoved.changed).toBe(true);
  });
});

describe("frame storyboard presentation", () => {
  it("renders frame ranges and a local baseline without a duplicate main heading", () => {
    const project = createProject("Demo");
    const html = renderToStaticMarkup(createElement(FrameStoryboard, {
      project, onChange: () => {}, selectedSceneId: project.scenes[0].id,
      onSelectScene: () => {},
    }));
    expect(html).toContain("900 / 900 frames");
    expect(html).toContain("frames [0, 180)");
    expect(html).toContain("No local review baseline.");
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("Changed since approval");
    expect(html).toContain('grid-template-columns:minmax(0, 180fr) minmax(0, 480fr) minmax(0, 240fr)');
  });

  it("shows caption errors, a mismatch warning and changed local snapshot labels", () => {
    const original = createProject("Demo");
    const project = editScene(original, original.scenes[0].id, {
      caption: "Seamless\u2014filter", frames: 181,
    });
    const html = renderToStaticMarkup(createElement(FrameStoryboard, {
      project, onChange: () => {}, selectedSceneId: project.scenes[0].id,
      onSelectScene: () => {}, reviewedScenes: original.scenes, disabled: true,
    }));
    expect(html).toContain("Storyboard changed, re-approval required");
    expect(html).toContain("Changed since approval");
    expect(html).toContain("No server approval is recorded here.");
    expect(html).toContain("901 / 900 frames");
    expect(html).toContain("1 frames above the MVP target.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Replace the em-dash");
    expect(html).toContain("marketing wording");
    expect(html).toContain('type="submit" class="fs-save" disabled=""');
    expect(html).toContain("Storyboard editing is disabled.");
  });
});
