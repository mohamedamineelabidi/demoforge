import { describe, expect, it, vi } from "vitest";
import { createProject } from "../model";
import { parseCatalog } from "../evidence/imports";
import fixture from "../../test-fixtures/catalog.json";
import { approvalSchema, createApproval } from "./schema";
import {
  canonicalSnapshot, claimsSubject, storyboardSubject, hashSnapshot,
  approvalMatches, currentDecisions, hashOutput, OUTPUT_LIMIT, OutputSession,
} from "./subjects";

const record = {
  schema_version: 1, approval_id: "local:decision-1", run_id: "local:project-1",
  subject_type: "claims", subject_id: "local:project-1:claims:catalog-1",
  subject_revision: 1, subject_sha256: "a".repeat(64), actor_id: "Review operator",
  decision: "approved", decided_at: "2026-09-12T12:00:00.000Z", note: null,
} as const;
const catalog = parseCatalog(JSON.stringify(fixture));

describe("local approval contract", () => {
  it("accepts exactly the snake_case contract and requires nullable note", () => {
    expect(approvalSchema.parse(record)).toEqual(record);
    const { note: omitted, ...missingNote } = record;
    expect(omitted).toBeNull();
    expect(approvalSchema.safeParse(missingNote).success).toBe(false);
    for (const patch of [{ schema_version: 2 }, { subject_type: "scenario" },
      { subjectType: "claims" }, { server_approved: true }, { actor_id: "  " },
      { decision: "pending" }, { subject_sha256: "A".repeat(64) },
      { subject_revision: 0 }, { subject_revision: 1.5 },
      { subject_revision: Number.MAX_SAFE_INTEGER + 1 },
      { decided_at: "2026-09-12T12:00:00" }, { decided_at: "2026-09-12T12:00:00+02:00" }]) {
      expect(approvalSchema.safeParse({ ...record, ...patch }).success).toBe(false);
    }
  });
  it("requires a nonblank rejection note and creates immutable local decisions", () => {
    for (const note of [null, "", "  "]) {
      expect(approvalSchema.safeParse({ ...record, decision: "rejected", note }).success).toBe(false);
    }
    const approval = createApproval({ ...record, decision: "rejected", note: "Fix the caption." });
    expect(Object.isFrozen(approval)).toBe(true);
    expect(approval.note).toBe("Fix the caption.");
    expect(approval.approval_id).not.toBe(record.approval_id);
    expect(approval.decided_at.endsWith("Z")).toBe(true);
  });
});

describe("revision-bound subjects", () => {
  it("hashes canonical content using SHA-256, preserving array order", async () => {
    expect(canonicalSnapshot({ zebra: 2, alpha: 1 })).toBe('{"alpha":1,"zebra":2}');
    expect(await hashSnapshot("abc")).toBe("6cc43f858fbb763301637b5af970e2a46b46f461f27e5a0f41e009c59b827b25");
    expect(await hashSnapshot({ zebra: 2, alpha: 1 })).toBe(await hashSnapshot({ alpha: 1, zebra: 2 }));
    expect(await hashSnapshot([1, 2])).not.toBe(await hashSnapshot([2, 1]));
    expect(() => canonicalSnapshot({ invalid: undefined })).toThrow();
    expect(() => canonicalSnapshot({ invalid: Infinity })).toThrow();
  });
  it("builds claims only from a nonempty imported catalog with local identity", () => {
    const project = createProject("Review");
    expect(claimsSubject(project)).toBeNull();
    expect(claimsSubject(project, { ...catalog, claims: [] })).toBeNull();
    const subject = claimsSubject(project, catalog)!;
    expect(subject.run_id).toBe(`local:${project.id}`);
    expect(subject.subject_id).toBe(`local:${project.id}:claims:${catalog.catalog_id}`);
    expect(subject.subject_revision).toBe(catalog.revision);
    expect(subject.snapshot).toEqual(catalog);
  });
  it("uses actual scenes, half-open 30 fps ranges, and excludes approval/history metadata", async () => {
    const project = createProject("Review");
    const subject = storyboardSubject(project, catalog)!;
    expect(subject.snapshot.fps).toBe(30);
    expect(subject.snapshot.scenes.map(scene => [scene.start, scene.end])).toEqual([[0, 180], [180, 660], [660, 900]]);
    expect(storyboardSubject({ ...project, scenes: [] }, catalog)).toBeNull();
    expect(storyboardSubject(project)).toBeNull();
    const renamed = storyboardSubject({ ...project, name: "Renamed", updatedAt: "later" }, catalog)!;
    expect(await hashSnapshot(subject.snapshot)).toBe(await hashSnapshot(renamed.snapshot));
    const edited = storyboardSubject({ ...project, scenes: project.scenes.map(scene => ({ ...scene, caption: "Changed" })) }, catalog)!;
    expect(await hashSnapshot(subject.snapshot)).not.toBe(await hashSnapshot(edited.snapshot));
    const changedEvidence = storyboardSubject(project, { ...catalog, evidence: catalog.evidence.map(item => ({ ...item, quote: "Changed evidence" })) })!;
    expect(await hashSnapshot(subject.snapshot)).not.toBe(await hashSnapshot(changedEvidence.snapshot));
    const unresolved = { ...project, scenes: [{ ...project.scenes[0], claimId: "missing" }] };
    expect(storyboardSubject(unresolved, catalog)).toBeNull();
  });
  it("matches all identity fields and retains only exact current decisions", () => {
    const approval = approvalSchema.parse(record);
    expect(approvalMatches(approval, approval)).toBe(true);
    for (const patch of [{ run_id: "local:other" }, { subject_type: "output" as const },
      { subject_id: "different" }, { subject_revision: 2 }, { subject_sha256: "b".repeat(64) }]) {
      expect(approvalMatches(approval, { ...approval, ...patch })).toBe(false);
    }
    expect(approvalMatches(approval, null)).toBe(false);
    const stale = approvalSchema.parse({ ...record, approval_id: "stale", subject_revision: 2 });
    expect(currentDecisions([stale, approval], approval)).toEqual([approval]);
    expect(stale.subject_revision).toBe(2);
  });
});

function mediaFile(content = "abc") {
  return { name: "output.mp4", type: "video/mp4", size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer };
}

describe("session-only output bytes", () => {
  it("hashes bytes, not filename or metadata, and rejects invalid bounds before reads", async () => {
    expect(await hashOutput(mediaFile())).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    for (const patch of [{ size: OUTPUT_LIMIT + 1 }, { size: 0 }, { name: "output.html" }, { type: "text/html" }]) {
      const arrayBuffer = vi.fn();
      await expect(hashOutput({ ...mediaFile(), ...patch, arrayBuffer })).rejects.toThrow();
      expect(arrayBuffer).not.toHaveBeenCalled();
    }
    await expect(hashOutput({ ...mediaFile(), size: 4 })).rejects.toThrow();
    await expect(hashOutput({ ...mediaFile(), arrayBuffer: async () => { throw new Error("private path"); } })).rejects.toThrow("File could not be read");
  });
  it("does not install stale reads, revokes URLs and survives an unrelated render", async () => {
    const create = vi.fn(() => "blob:local-output");
    const revoke = vi.fn();
    const session = new OutputSession({ create, revoke });
    let resolveRead!: (buffer: ArrayBuffer) => void;
    const pending = session.select({ ...mediaFile(), arrayBuffer: () => new Promise(resolve => { resolveRead = resolve; }) });
    session.clear();
    resolveRead(new TextEncoder().encode("abc").buffer);
    expect(await pending).toBeNull();
    expect(create).not.toHaveBeenCalled();
    const selected = await session.select(mediaFile());
    expect(selected?.url).toBe("blob:local-output");
    expect(session.current).toBe(selected);
    expect(revoke).not.toHaveBeenCalled();
    session.clear();
    expect(revoke).toHaveBeenCalledWith("blob:local-output");
    expect(session.current).toBeNull();
  });
  it("lets the newest read win and suppresses cancelled read errors", async () => {
    const create = vi.fn(() => "blob:new");
    const session = new OutputSession({ create, revoke: vi.fn() });
    let rejectRead!: (reason: Error) => void;
    const previous = session.select({ ...mediaFile(), arrayBuffer: () => new Promise((_resolve, reject) => { rejectRead = reject; }) });
    await session.select(mediaFile("new"));
    rejectRead(new Error("old failure"));
    expect(await previous).toBeNull();
    expect(session.current?.url).toBe("blob:new");
    expect(create).toHaveBeenCalledTimes(1);
    session.clear();
  });
});