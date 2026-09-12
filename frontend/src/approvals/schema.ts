import { z } from "zod";

const identifier = z.string().trim().min(1);

export const approvalSchema = z.strictObject({
  schema_version: z.literal(1),
  approval_id: identifier,
  run_id: identifier,
  subject_type: z.enum(["claims", "storyboard", "output"]),
  subject_id: identifier,
  subject_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  subject_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  actor_id: identifier,
  decision: z.enum(["approved", "rejected"]),
  decided_at: z.iso.datetime(),
  note: z.string().nullable(),
}).superRefine((approval, context) => {
  if (approval.decision === "rejected" && !approval.note?.trim()) {
    context.addIssue({ code: "custom", path: ["note"], message: "A rejection needs a note." });
  }
}).readonly();

export type Approval = z.infer<typeof approvalSchema>;

export function createApproval(
  input: Omit<Approval, "schema_version" | "approval_id" | "decided_at">,
): Approval {
  return approvalSchema.parse({
    ...input,
    schema_version: 1,
    approval_id: `local:${crypto.randomUUID()}`,
    decided_at: new Date().toISOString(),
    note: input.note?.trim() || null,
  });
}