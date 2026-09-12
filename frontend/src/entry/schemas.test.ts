import { describe, expect, it } from "vitest";
import {
  acceptsFootage,
  attestationSchema,
  briefSchema,
  firstIssue,
  lintBrief,
  parseGithubUrl,
  repositorySchema,
} from "./schemas";

describe("parseGithubUrl", () => {
  it("parses owner and repo", () => {
    expect(parseGithubUrl("https://github.com/nousresearch/hermes-agent")).toEqual({
      owner: "nousresearch",
      repo: "hermes-agent",
    });
    expect(parseGithubUrl(" https://github.com/a/b.git/ ")).toEqual({
      owner: "a",
      repo: "b",
    });
  });
  it("rejects non-GitHub, http, and partial URLs", () => {
    expect(parseGithubUrl("http://github.com/a/b")).toBeNull();
    expect(parseGithubUrl("https://gitlab.com/a/b")).toBeNull();
    expect(parseGithubUrl("https://github.com/a")).toBeNull();
    expect(parseGithubUrl("https://github.com/a/b/tree/main")).toBeNull();
    expect(parseGithubUrl("github.com/a/b")).toBeNull();
  });
});

describe("repositorySchema", () => {
  it("accepts a valid URL with an empty or 40-hex commit", () => {
    expect(
      repositorySchema.safeParse({ url: "https://github.com/a/b", commit: "" })
        .success,
    ).toBe(true);
    const sha = "A".repeat(40).toLowerCase();
    const parsed = repositorySchema.parse({
      url: "https://github.com/a/b",
      commit: sha.toUpperCase(),
    });
    expect(parsed.commit).toBe(sha);
  });
  it("reports field-level messages", () => {
    const errors = firstIssue(
      repositorySchema.safeParse({ url: "nope", commit: "abc" }),
    );
    expect(errors.url).toMatch(/owner\/repo/);
    expect(errors.commit).toMatch(/40 hexadecimal/);
  });
});

describe("briefSchema", () => {
  it("enforces limits", () => {
    expect(
      briefSchema.safeParse({
        name: "Filter completed tasks",
        changed: "Users can now hide finished tasks with one click.",
        audience: "Team leads",
      }).success,
    ).toBe(true);
    const errors = firstIssue(
      briefSchema.safeParse({
        name: "x".repeat(61),
        changed: "y".repeat(301),
        audience: "",
      }),
    );
    expect(errors.name).toMatch(/60/);
    expect(errors.changed).toMatch(/300/);
    expect(errors.audience).toBeTruthy();
  });
});

describe("lintBrief", () => {
  it("flags em-dashes with their position", () => {
    const issues = lintBrief("Fast \u2014 and clear");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "em-dash", index: 5 });
  });
  it("flags marketing words case-insensitively and on word boundaries", () => {
    const issues = lintBrief("A Seamless, game-changing, revolutionary filter");
    expect(issues.map((issue) => issue.term)).toEqual([
      "Seamless",
      "game-changing",
      "revolutionary",
    ]);
    expect(lintBrief("seamlessness is a word")).toHaveLength(0);
  });
  it("returns nothing for plain wording", () => {
    expect(lintBrief("Hide finished tasks with one click.")).toEqual([]);
  });
});

describe("footage", () => {
  it("accepts mp4/webm/mov and rejects other files", () => {
    expect(acceptsFootage({ name: "a.mp4", type: "video/mp4", size: 10 })).toBeNull();
    expect(acceptsFootage({ name: "a.webm", type: "video/webm", size: 10 })).toBeNull();
    expect(acceptsFootage({ name: "a.mov", type: "", size: 10 })).toBeNull();
    expect(acceptsFootage({ name: "a.gif", type: "image/gif", size: 10 })).toMatch(/MP4/);
    expect(acceptsFootage({ name: "a.mp4", type: "video/mp4", size: 0 })).toMatch(/empty/);
    expect(
      acceptsFootage({ name: "a.mp4", type: "video/mp4", size: 600 * 1024 * 1024 }),
    ).toMatch(/500 MB/);
  });
  it("requires the attestation and an actor label", () => {
    const errors = firstIssue(
      attestationSchema.safeParse({ hasFile: true, authorized: false, actor: "" }),
    );
    expect(errors.authorized).toMatch(/authorized/);
    expect(errors.actor).toBeTruthy();
    expect(
      attestationSchema.safeParse({ hasFile: true, authorized: true, actor: "Amine" })
        .success,
    ).toBe(true);
  });
});
