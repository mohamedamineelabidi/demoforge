import type { TeaserRun } from "./api";

export type CreateKey = { repository: string; id: string; runId: string | null };

export function isTerminal(run: TeaserRun): boolean {
  return ["complete", "failed", "cancelled"].includes(run.state);
}

export function nextCreateKey(
  previous: CreateKey | null, repository: string, runs: TeaserRun[], makeId: () => string,
): CreateKey {
  const confirmed = runs.find(run => run.run_id === previous?.runId);
  if (!previous || previous.repository !== repository || (confirmed && isTerminal(confirmed))) {
    return { repository, id: makeId(), runId: null };
  }
  return previous;
}

export function stepIndex(run: TeaserRun | null): number {
  if (!run) return 0;
  if (run.state === "complete" || run.preview_url || run.checkpoint?.subject_type === "output") return 3;
  if (run.checkpoint?.subject_type === "storyboard" && run.approved) return 2;
  if (run.stage === "teaser-render") return 2;
  return run.storyboard ? 1 : 0;
}

export function runStatus(run: TeaserRun): string {
  if (run.state === "failed") return "Run failed";
  if (run.state === "cancelled") return "Run cancelled";
  if (run.state === "complete") return Object.keys(run.downloads).length ? "Downloads ready" : "Run complete";
  if (run.state === "awaiting_approval") {
    if (run.checkpoint?.subject_type === "output") {
      return run.approved ? "Ready to export" : "Review the rendered video";
    }
    if (run.checkpoint?.subject_type === "storyboard") {
      return run.approved ? "Ready to render" : "Review the source storyboard";
    }
  }
  if (run.state === "pending") return "Ready to prepare storyboard";
  return `Last reported: ${run.state.replaceAll("_", " ")}`;
}