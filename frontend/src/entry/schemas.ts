import { z } from "zod";

export const GITHUB_URL_PATTERN =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function parseGithubUrl(
  value: string,
): { owner: string; repo: string } | null {
  const match = GITHUB_URL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, owner, repo] = match;
  if (!owner || !repo || repo === "." || repo === "..") return null;
  return { owner, repo };
}

export const repositorySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter the repository URL.")
    .refine((value) => parseGithubUrl(value) !== null, {
      message: "Use the form https://github.com/owner/repo.",
    }),
  commit: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === "" || SHA_PATTERN.test(value), {
      message: "A commit SHA has exactly 40 hexadecimal characters.",
    }),
});
export type RepositoryInput = z.infer<typeof repositorySchema>;

export const BRIEF_LIMITS = { name: 60, changed: 300, audience: 120 } as const;

export const briefSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name the feature.")
    .max(BRIEF_LIMITS.name, `Keep the name to ${BRIEF_LIMITS.name} characters.`),
  changed: z
    .string()
    .trim()
    .min(1, "Describe what changed.")
    .max(
      BRIEF_LIMITS.changed,
      `Keep the description to ${BRIEF_LIMITS.changed} characters.`,
    ),
  audience: z
    .string()
    .trim()
    .min(1, "Say who this is for.")
    .max(
      BRIEF_LIMITS.audience,
      `Keep the audience to ${BRIEF_LIMITS.audience} characters.`,
    ),
});
export type BriefInput = z.infer<typeof briefSchema>;

export const MARKETING_WORDS = [
  "revolutionary",
  "seamless",
  "seamlessly",
  "game-changing",
  "game changing",
  "cutting-edge",
  "next-generation",
  "best-in-class",
  "world-class",
  "effortless",
  "unleash",
  "supercharge",
  "delightful",
] as const;

export type LintIssue = {
  kind: "em-dash" | "marketing";
  term: string;
  index: number;
  message: string;
};

export function lintBrief(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\u2014") {
      issues.push({
        kind: "em-dash",
        term: "\u2014",
        index,
        message: "Replace the em-dash with a comma, a full stop or a colon.",
      });
    }
  }
  const lower = text.toLowerCase();
  for (const word of MARKETING_WORDS) {
    let from = 0;
    while (from <= lower.length) {
      const index = lower.indexOf(word, from);
      if (index < 0) break;
      const before = index === 0 ? " " : lower[index - 1];
      const after = lower[index + word.length] ?? " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        issues.push({
          kind: "marketing",
          term: text.slice(index, index + word.length),
          index,
          message: `"${text.slice(index, index + word.length)}" is marketing wording. Say what the feature does instead.`,
        });
      }
      from = index + word.length;
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}

export const FOOTAGE_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const FOOTAGE_EXTENSIONS = [".mp4", ".webm", ".mov"];
export const FOOTAGE_MAX_BYTES = 500 * 1024 * 1024;

export function acceptsFootage(file: { name: string; type: string; size: number }) {
  const name = file.name.toLowerCase();
  const typeOk =
    FOOTAGE_TYPES.includes(file.type) ||
    (file.type === "" && FOOTAGE_EXTENSIONS.some((ext) => name.endsWith(ext)));
  const extensionOk = FOOTAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk || !extensionOk) return "Choose an MP4, WebM or MOV file.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > FOOTAGE_MAX_BYTES) return "Choose a file smaller than 500 MB.";
  return null;
}

export const attestationSchema = z.object({
  hasFile: z.literal(true, { message: "Add one footage file." }),
  authorized: z.literal(true, {
    message: "Confirm that you are authorized to use this footage.",
  }),
  actor: z
    .string()
    .trim()
    .min(1, "Name the person or team who recorded or owns the footage.")
    .max(80, "Keep the label to 80 characters."),
});
export type AttestationInput = z.infer<typeof attestationSchema>;

export type FootageMeta = {
  duration: number | null;
  width: number | null;
  height: number | null;
};

export function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "unknown";
  const whole = Math.round(seconds * 10) / 10;
  return `${whole.toFixed(1)} s`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function firstIssue(
  result: z.ZodSafeParseResult<unknown>,
): Record<string, string> {
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
