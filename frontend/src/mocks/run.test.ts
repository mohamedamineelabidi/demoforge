import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  LOCAL_RUN_OUTCOMES,
  LOCAL_RUN_STAGES,
  localRunStatusSchema,
  mockRunStatus,
} from "./run";
import type { RunState, RunStatus } from "./run";
import { RunStatusPanel } from "../run/RunStatusPanel";

function fixture(overrides: Record<string, unknown> = {}): RunStatus {
  return localRunStatusSchema.parse({
    kind: "local-display-mock",
    current: "awaiting_approval",
    completedStages: ["created", "ingesting", "planning"],
    attempts: { stage: "planning", transient: 1, repair: 0 },
    ...overrides,
  });
}

function render(run: RunStatus): string {
  return renderToStaticMarkup(createElement(RunStatusPanel, { run }));
}

function stateMarkup(markup: string, state: RunState): string {
  const match = markup.match(
    new RegExp(`<li\\b[^>]*data-run-state="${state}"[^>]*>[\\s\\S]*?</li>`),
  );
  expect(match, `Missing state ${state}`).not.toBeNull();
  return match![0];
}

describe("localRunStatusSchema", () => {
  it("keeps ordered stages separate from alternative terminal outcomes", () => {
    expect(LOCAL_RUN_STAGES).toEqual([
      "created", "ingesting", "planning", "awaiting_approval",
      "acquiring_footage", "storyboarding", "rendering", "reviewing",
    ]);
    expect(LOCAL_RUN_OUTCOMES).toEqual(["complete", "failed", "cancelled"]);
    expect(localRunStatusSchema.parse(mockRunStatus)).toEqual(mockRunStatus);
    expect(mockRunStatus.kind).toBe("local-display-mock");
  });

  it.each([...LOCAL_RUN_STAGES, ...LOCAL_RUN_OUTCOMES])("accepts %s", (current) => {
    expect(fixture({ current, completedStages: [] }).current).toBe(current);
  });

  it.each(["pending", "running", "unknown", "", null, 1])(
    "rejects unknown current state %s, including unmapped backend pending",
    (current) => {
      expect(() => fixture({ current })).toThrow();
    },
  );

  it.each([
    { transient: 0, repair: 0 },
    { transient: 3, repair: 0 },
    { transient: 1, repair: 1 },
    { transient: 3, repair: 1 },
  ])("accepts counter boundaries %j", (counts) => {
    expect(fixture({ attempts: { stage: "planning", ...counts } }).attempts)
      .toEqual({ stage: "planning", ...counts });
  });

  it.each([
    { transient: -1, repair: 0 },
    { transient: 4, repair: 0 },
    { transient: 0.5, repair: 0 },
    { transient: "1", repair: 0 },
    { transient: null, repair: 0 },
    { transient: NaN, repair: 0 },
    { transient: Infinity, repair: 0 },
    { transient: 1, repair: -1 },
    { transient: 1, repair: 2 },
    { transient: 1, repair: 0.5 },
    { transient: 1, repair: "1" },
  ])("rejects invalid counters %j", (counts) => {
    expect(() => fixture({ attempts: { stage: "planning", ...counts } })).toThrow();
  });

  it.each([
    { kind: "api-run-record" },
    { kind: undefined },
    { current: undefined },
    { completedStages: undefined },
    { attempts: undefined },
    { backendId: "run-1" },
    { attempts: { stage: "unknown", transient: 1, repair: 0 } },
    { attempts: { stage: "complete", transient: 1, repair: 0 } },
    { attempts: { stage: "planning", transient: 1 } },
    { attempts: { stage: "planning", transient: 1, repair: 0, retries: 1 } },
    { completedStages: ["created", "created"] },
    { completedStages: ["awaiting_approval"] },
    { completedStages: ["complete"] },
    { completedStages: ["unknown"] },
  ])("rejects incomplete or contradictory mock records %j", (overrides) => {
    expect(() => fixture(overrides)).toThrow();
  });

  it("freezes the record, completed stages and stage-scoped counters", () => {
    const run = fixture();
    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.completedStages)).toBe(true);
    expect(Object.isFrozen(run.attempts)).toBe(true);
    expect(Object.isFrozen(LOCAL_RUN_STAGES)).toBe(true);
    expect(Object.isFrozen(LOCAL_RUN_OUTCOMES)).toBe(true);
  });
});

describe("RunStatusPanel", () => {
  it("labels its static local-only source and offers no execution controls", () => {
    const markup = render(mockRunStatus);
    expect(markup).toContain("Mock run / Backend not connected");
    expect(markup).toContain("Current mock stage: <strong>Awaiting approval</strong>");
    expect(markup).toContain("Planning attempts");
    expect(markup).toContain("Transient attempts");
    expect(markup).toContain("Content repairs");
    expect(markup).toContain("1 / 3");
    expect(markup).toContain("0 / 1");
    expect(markup).not.toMatch(/<button|<progress|aria-busy="true"|role="timer"/);
    expect(markup).not.toMatch(/\bETA\b|\d+%|aria-live/);
  });

  it("shows zero and maximum budgets without hiding zero values", () => {
    expect(render(fixture({ attempts: { stage: "planning", transient: 0, repair: 0 } })))
      .toContain("0 / 3");
    const markup = render(fixture({ attempts: { stage: "planning", transient: 3, repair: 1 } }));
    expect(markup).toContain("3 / 3");
    expect(markup).toContain("1 / 1");
  });

  it.each(LOCAL_RUN_STAGES)("marks only %s as the current mock stage", (current) => {
    const markup = render(fixture({ current, completedStages: [] }));
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(stateMarkup(markup, current)).toContain('aria-current="step"');
    expect(stateMarkup(markup, current)).toContain('data-presentation="current"');
    expect(markup).not.toContain('data-presentation="completed"');
  });

  it("marks only explicitly completed stages, never earlier ordinal stages", () => {
    const markup = render(fixture({ current: "rendering", completedStages: ["ingesting"] }));
    expect(stateMarkup(markup, "ingesting")).toContain('data-presentation="completed"');
    expect(stateMarkup(markup, "ingesting")).toContain("Completed in mock");
    for (const stage of ["created", "planning", "storyboarding", "reviewing"] as const) {
      expect(stateMarkup(markup, stage)).toContain('data-presentation="unobserved"');
      expect(stateMarkup(markup, stage)).toContain("Not observed");
    }
    expect(stateMarkup(markup, "rendering")).toContain('data-tone="active"');
  });

  it("distinguishes paused approval from an active stage", () => {
    const markup = render(fixture());
    expect(stateMarkup(markup, "awaiting_approval")).toContain('data-tone="waiting"');
    expect(stateMarkup(markup, "awaiting_approval")).toContain("Paused in mock");
  });

  it.each(LOCAL_RUN_OUTCOMES)("shows %s as one alternative terminal outcome", (current) => {
    const markup = render(fixture({ current, completedStages: [] }));
    expect(markup).toContain('<ul class="run-status-outcomes" aria-label="Alternative terminal outcomes">');
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup).not.toContain('data-presentation="completed"');
    const selected = stateMarkup(markup, current);
    expect(selected).toContain('aria-current="step"');
    expect(selected).toContain('data-presentation="current"');
    expect(selected).toContain(`data-tone="${current}"`);
    expect(selected).toContain("Mock outcome");
    for (const outcome of LOCAL_RUN_OUTCOMES.filter((outcome) => outcome !== current)) {
      expect(stateMarkup(markup, outcome)).toContain('data-presentation="alternative"');
      expect(stateMarkup(markup, outcome)).toContain("Not selected");
      expect(stateMarkup(markup, outcome)).not.toContain("aria-current");
    }
    expect(stateMarkup(markup, "reviewing")).toContain("Not observed");
  });

  it("does not mutate input or invent activity between renders", () => {
    const run = fixture();
    const before = JSON.stringify(run);
    expect(render(run)).toBe(render(run));
    expect(JSON.stringify(run)).toBe(before);
  });
});