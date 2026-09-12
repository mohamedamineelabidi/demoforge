export type TeaserSubject = {
  subject_type: "storyboard" | "output";
  subject_id: string;
  subject_revision: number;
  subject_sha256: string;
};

export type TeaserRun = {
  run_id: string;
  state: string;
  stage: string | null;
  created_at: string;
  repository_url: string;
  checkpoint: TeaserSubject | null;
  approved: boolean;
  error: string | null;
  storyboard: null | { scenes: Array<{
    scene_id: string; kind: string; start_frame: number; end_frame: number;
    text: string; evidence_id: string;
  }> };
  catalog: null | {
    repository: { commit_sha: string };
    evidence: Array<{ evidence_id: string; source: string; quote: string;
      line_start: number | null; line_end: number | null }>;
  };
  preview_url: string | null;
  downloads: Record<string, string>;
};

export async function teaserRequest<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  let result: T & { error?: string };
  try {
    response = await fetch(path, body === undefined ? { cache: "no-store" } : {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store",
    });
    result = await response.json();
  } catch {
    throw new Error("Local backend unavailable. Start DemoForge serve on port 8000 and retry.");
  }
  if (!response.ok) throw new Error(result.error ?? "Local request failed. Refresh the run.");
  return result;
}

export function artifactUrl(run: TeaserRun, identity: string): string {
  return `/api/runs/${encodeURIComponent(run.run_id)}/artifacts/${identity}`;
}