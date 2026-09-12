import { z } from "zod";

const text = z.string().trim().min(1);
const revision = z.number().int().positive();
const sha1 = z.string().regex(/^[0-9a-f]{40}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const timestamp = z.iso.datetime({ offset: true });
const strings = z.array(z.string()).max(2000);
const ids = z.array(text).max(2000);
const unique = (values: string[]) => new Set(values).size === values.length;
const relativePath = z.string().refine(value => Boolean(value) && value === value.trim() &&
  !value.includes("\\") && !value.startsWith("/") && !value.startsWith("~") &&
  value[1] !== ":" && !value.includes("://") && value.split("/").every(part => !["", ".", ".."].includes(part)));

const evidenceSchema = z.strictObject({
  schema_version: z.literal(1), evidence_id: text,
  kind: z.enum(["repository", "website", "api", "observation", "attestation"]),
  source: text, revision: sha1.nullable(), line_start: z.number().int().positive().nullable(),
  line_end: z.number().int().positive().nullable(), quote: z.string(), acquired_at: timestamp,
  content_sha256: sha256, observation_id: text.nullable(), attestation_id: text.nullable(),
}).superRefine((item, context) => {
  const invalidRange = (item.line_start === null) !== (item.line_end === null) ||
    (item.line_start !== null && item.line_end !== null && item.line_end < item.line_start);
  if (invalidRange || (item.kind === "repository" && (item.revision === null || item.line_start === null)))
    context.addIssue({ code: "custom", message: "Invalid evidence revision or line range" });
  if ((item.kind === "observation" && !item.observation_id) || (item.kind === "attestation" && !item.attestation_id))
    context.addIssue({ code: "custom", message: "Evidence requires observation or attestation identity" });
});

const claimSchema = z.strictObject({
  schema_version: z.literal(1), claim_id: text, revision, text,
  evidence_ids: ids.min(1).refine(unique),
  verification_status: z.enum(["documented", "statically_supported", "runtime_observed", "user_attested"]),
  limitations: strings.default([]),
});

const catalogSchema = z.strictObject({
  schema_version: z.literal(1), catalog_id: text, revision,
  repository: z.strictObject({ repo_url: text, full_name: text, commit_sha: sha1,
    acquired_at: timestamp, license: z.string().nullable(), metadata_evidence_ids: ids.default([]) }),
  evidence: z.array(evidenceSchema).max(2000).default([]),
  claims: z.array(claimSchema).max(2000).default([]), assets: ids.default([]),
  files: z.array(z.strictObject({ path: relativePath,
    classification: z.enum(["readme", "docs", "manifest", "source_code", "test", "config", "image", "media", "license", "lockfile", "binary", "other"]),
    size_bytes: z.number().int().nonnegative(), content_sha256: sha256,
    scan_status: z.enum(["clean", "redacted", "excluded", "not_scanned"]), exclusion_reason: z.string().nullable(),
  })).max(5000).default([]),
}).superRefine((catalog, context) => {
  const reject = (message: string) => context.addIssue({ code: "custom", message });
  if (!unique(catalog.evidence.map(item => item.evidence_id)) || !unique(catalog.claims.map(item => item.claim_id)) || !unique(catalog.files.map(item => item.path))) reject("Duplicate catalog identifiers");
  const index = new Map(catalog.evidence.map(item => [item.evidence_id, item]));
  if (catalog.repository.metadata_evidence_ids.some(id => !index.has(id))) reject("Missing metadata evidence");
  if (catalog.evidence.some(item => item.kind === "repository" && item.revision !== catalog.repository.commit_sha)) reject("Repository revision mismatch");
  if (catalog.files.some(item => item.scan_status === "not_scanned")) reject("Catalog contains unscanned files");
  for (const claim of catalog.claims) {
    if (claim.evidence_ids.some(id => !index.has(id))) reject("Dangling claim evidence");
    const kinds = claim.evidence_ids.map(id => index.get(id)?.kind);
    if (claim.verification_status === "runtime_observed" && !kinds.includes("observation")) reject("Runtime claim requires observation evidence");
    if (claim.verification_status === "user_attested" && !kinds.includes("attestation")) reject("Attested claim requires attestation evidence");
  }
});

function safeMeasurement(value: unknown): boolean {
  const pending: unknown[] = [value];
  const forbidden = new Set(["value", "values", "secret", "secrets", "token", "password", "key"]);
  while (pending.length) {
    const current = pending.pop();
    if (current && typeof current === "object") {
      for (const [name, child] of Object.entries(current)) {
        if (forbidden.has(name.toLowerCase())) return false;
        pending.push(child);
      }
    }
  }
  return true;
}

const reportSchema = z.strictObject({
  schema_version: z.literal(1), report_id: text, subject_id: text, subject_revision: revision,
  gate: z.enum(["pass", "ask_user", "fail"]),
  checks: z.array(z.strictObject({ check_id: text, status: z.enum(["pass", "fail", "not_run"]),
    required: z.boolean(), measurement: z.record(z.string(), z.unknown()).nullable().refine(safeMeasurement),
    reason: z.string().nullable(),
  })).max(2000).default([]), missing_inputs: strings.default([]), questions: strings.default([]), warnings: strings.default([]),
}).superRefine((report, context) => {
  if (!unique(report.checks.map(check => check.check_id)) ||
    (report.gate === "pass" && report.checks.some(check => check.required && check.status !== "pass")) ||
    (report.gate === "ask_user" && !report.questions.length && !report.missing_inputs.length))
    context.addIssue({ code: "custom", message: "Inconsistent quality gate" });
});

export type Catalog = z.infer<typeof catalogSchema>;
export type QualityReport = z.infer<typeof reportSchema>;
export type ImportedArtifacts = { catalog?: Catalog; report?: QualityReport };
export const IMPORT_LIMIT = 2_000_000;

function parse<T>(raw: string, schema: z.ZodType<T>, kind: string): T {
  if (new TextEncoder().encode(raw).byteLength > IMPORT_LIMIT) throw new Error("Import must be 2 MB or smaller.");
  try { return schema.parse(JSON.parse(raw)); }
  catch { throw new Error(`Invalid ${kind}. Check version 1 fields, identifiers, hashes, references and gate consistency. Only sanitized artifacts are supported.`); }
}

export function parseCatalog(raw: string) { return parse(raw, catalogSchema, "evidence catalog"); }
export function parseQualityReport(raw: string) { return parse(raw, reportSchema, "quality report"); }

export async function readImport(file: Pick<File, "size" | "text">, kind: "catalog" | "report") {
  if (file.size > IMPORT_LIMIT) throw new Error("Import must be 2 MB or smaller.");
  let raw: string;
  try { raw = await file.text(); } catch { throw new Error("File could not be read. Choose it again."); }
  return kind === "catalog" ? { catalog: parseCatalog(raw) } : { report: parseQualityReport(raw) };
}

export function reportAssociation(report: Pick<QualityReport, "subject_id" | "subject_revision">, catalog?: Pick<Catalog, "catalog_id" | "revision">) {
  if (!catalog || report.subject_id !== catalog.catalog_id) return "unassociated";
  return report.subject_revision === catalog.revision ? "matching" : "stale";
}