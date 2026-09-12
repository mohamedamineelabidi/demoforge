import { describe, expect, it } from "vitest";
import {
  createProject,
  editScene,
  moveScene,
  parseProjects,
  timeline,
  undo,
  redo,
} from "./model";

describe("local storyboard drafts", () => {
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
});
