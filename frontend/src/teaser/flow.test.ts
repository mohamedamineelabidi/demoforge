import { expect, test } from "vitest";
import type { TeaserRun } from "./api";
import { nextCreateKey, runStatus, stepIndex } from "./flow";

const repository = "https://github.com/fixture/taskroom";
const key = { repository, id: "original", runId: "run-1" };
const makeId = () => "fresh";

function run(overrides: Partial<TeaserRun> = {}): TeaserRun {
  return {
    run_id: "run-1", repository_url: repository, state: "pending", stage: null,
    created_at: "2026-09-12T00:00:00Z", checkpoint: null, approved: false,
    error: null, storyboard: null, catalog: null, preview_url: null, downloads: {},
    ...overrides,
  };
}

test.each(["failed", "cancelled", "complete"])("new request after confirmed %s", state => {
  expect(nextCreateKey(key, repository, [run({ state })], makeId)).toEqual({
    repository, id: "fresh", runId: null,
  });
});

test("uncertain create and advance responses keep the same request ID", () => {
  const uncertain = { ...key, runId: null };
  expect(nextCreateKey(uncertain, repository, [], makeId)).toBe(uncertain);
  expect(nextCreateKey(key, repository, [run()], makeId)).toBe(key);
  expect(nextCreateKey(key, repository, [], makeId)).toBe(key);
});

test("another terminal run for the same repository does not retire an uncertain request", () => {
  expect(nextCreateKey(key, repository, [run({ run_id: "other", state: "failed" })], makeId)).toBe(key);
});

test("first submission and changed repositories receive an ID", () => {
  expect(nextCreateKey(null, repository, [], makeId)).toEqual({ repository, id: "fresh", runId: null });
  expect(nextCreateKey(key, `${repository}-new`, [], makeId).id).toBe("fresh");
});

test("steps follow actual artifacts and exact approval state", () => {
  expect(stepIndex(null)).toBe(0);
  expect(stepIndex(run())).toBe(0);
  const storyboard = run({ state: "awaiting_approval", storyboard: { scenes: [] }, checkpoint: {
    subject_type: "storyboard", subject_id: "storyboard", subject_revision: 1,
    subject_sha256: "a".repeat(64),
  } });
  expect(stepIndex(storyboard)).toBe(1);
  expect(runStatus(storyboard)).toBe("Review the source storyboard");
  expect(stepIndex({ ...storyboard, approved: true })).toBe(2);
  expect(runStatus({ ...storyboard, approved: true })).toBe("Ready to render");
  const output = { ...storyboard, preview_url: "/preview", checkpoint: {
    ...storyboard.checkpoint!, subject_type: "output" as const,
  } };
  expect(stepIndex(output)).toBe(3);
  expect(runStatus(output)).toBe("Review the rendered video");
  expect(runStatus({ ...output, approved: true })).toBe("Ready to export");
});

test("terminal and running statuses do not imply successful downloads or live progress", () => {
  expect(runStatus(run({ state: "failed" }))).toBe("Run failed");
  expect(runStatus(run({ state: "cancelled" }))).toBe("Run cancelled");
  expect(runStatus(run({ state: "complete" }))).toBe("Run complete");
  expect(runStatus(run({ state: "complete", downloads: { video: "/video" } }))).toBe("Downloads ready");
  expect(runStatus(run({ state: "running" }))).toBe("Last reported: running");
});