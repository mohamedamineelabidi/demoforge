import type { Project } from "../model";
import { timeline } from "../model";
import type { Catalog } from "../evidence/imports";
import type { Approval } from "./schema";

export type SubjectIdentity = Pick<Approval,
  "run_id" | "subject_type" | "subject_id" | "subject_revision">;
export type HashedSubject = SubjectIdentity & Pick<Approval, "subject_sha256">;
export type ReviewSubject = SubjectIdentity & { snapshot: unknown };

export function canonicalSnapshot(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalSnapshot).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalSnapshot((value as Record<string, unknown>)[key])}`,
    ).join(",")}}`;
  }
  throw new Error("Snapshot must contain only JSON values.");
}

async function sha256(bytes: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable. Use a secure local browser context.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function hashSnapshot(value: unknown) {
  return sha256(new TextEncoder().encode(canonicalSnapshot(value)).buffer);
}

export function claimsSubject(project: Project, catalog?: Catalog) {
  if (!catalog?.claims.length) return null;
  return {
    run_id: `local:${project.id}`,
    subject_type: "claims" as const,
    subject_id: `local:${project.id}:claims:${catalog.catalog_id}`,
    subject_revision: catalog.revision,
    snapshot: catalog,
  };
}

export function storyboardSubject(project: Project, catalog?: Catalog) {
  if (!catalog?.claims.length || !project.scenes.length) return null;
  if (project.scenes.some(scene => scene.claimId && !catalog.claims.some(claim => claim.claim_id === scene.claimId))) return null;
  return {
    run_id: `local:${project.id}`,
    subject_type: "storyboard" as const,
    subject_id: `local:${project.id}:storyboard`,
    subject_revision: project.revision,
    snapshot: { fps: 30, accent: project.accent, scenes: timeline(project.scenes), catalog },
  };
}

export function approvalMatches(approval: Approval, subject: HashedSubject | null): boolean {
  return subject !== null && approval.run_id === subject.run_id &&
    approval.subject_type === subject.subject_type && approval.subject_id === subject.subject_id &&
    approval.subject_revision === subject.subject_revision && approval.subject_sha256 === subject.subject_sha256;
}

export function currentDecisions(drafts: readonly Approval[], subject: HashedSubject | null) {
  return drafts.filter(approval => approvalMatches(approval, subject));
}

export const OUTPUT_LIMIT = 128 * 1024 * 1024;
export type OutputFile = Pick<File, "name" | "type" | "size" | "arrayBuffer">;
export type SelectedOutput = { name: string; size: number; sha256: string; url: string };

export async function hashOutput(file: OutputFile): Promise<string> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > OUTPUT_LIMIT) {
    throw new Error("Output must be nonempty and 128 MiB or smaller.");
  }
  if (!/\.mp4$/i.test(file.name) || (file.type !== "video/mp4" && file.type !== "")) {
    throw new Error("Choose a local MP4 file. File type is not a media integrity check.");
  }
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { throw new Error("File could not be read. Choose it again."); }
  if (bytes.byteLength !== file.size || bytes.byteLength > OUTPUT_LIMIT) {
    throw new Error("File size changed during reading. Choose it again.");
  }
  return sha256(bytes);
}

export class OutputSession {
  private request = 0;
  current: SelectedOutput | null = null;

  constructor(private readonly urls = {
    create: (file: OutputFile) => URL.createObjectURL(file as File),
    revoke: (url: string) => URL.revokeObjectURL(url),
  }) {}

  clear() {
    this.request += 1;
    if (this.current) this.urls.revoke(this.current.url);
    this.current = null;
  }

  async select(file: OutputFile): Promise<SelectedOutput | null> {
    this.clear();
    const request = this.request;
    try {
      const hash = await hashOutput(file);
      if (request !== this.request) return null;
      const url = this.urls.create(file);
      this.current = { name: file.name, size: file.size, sha256: hash, url };
      return this.current;
    } catch (error) {
      if (request !== this.request) return null;
      throw error;
    }
  }
}