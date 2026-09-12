import {
  BRIEF_LIMITS,
  firstIssue,
  lintBrief,
  parseGithubUrl,
  repositorySchema,
} from "../entry/schemas";

export type SourceDraftInput = { name: string; repository: string; brief: string };
export type SourceEntryErrors = Partial<Record<"url" | "brief" | "commit", string>>;

export function prepareRepositoryDraft(
  url: string,
  brief: string,
  commit: string,
): { success: true; input: SourceDraftInput } | { success: false; errors: SourceEntryErrors } {
  const result = repositorySchema.safeParse({ url, commit });
  const errors: SourceEntryErrors = firstIssue(result);
  const trimmedBrief = brief.trim();
  if (trimmedBrief.length > BRIEF_LIMITS.changed) {
    errors.brief = `Keep the brief to ${BRIEF_LIMITS.changed} characters.`;
  } else {
    const issues = lintBrief(trimmedBrief);
    if (issues.length) errors.brief = issues.map((issue) => issue.message).join(" ");
  }
  const parsed = result.success ? parseGithubUrl(result.data.url) : null;
  if (!result.success || !parsed || Object.keys(errors).length) {
    return { success: false, errors };
  }
  const repository = `https://github.com/${parsed.owner}/${parsed.repo}`;
  return {
    success: true,
    input: {
      name: parsed.repo,
      repository: result.data.commit ? `${repository}@${result.data.commit}` : repository,
      brief: trimmedBrief,
    },
  };
}