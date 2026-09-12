import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Film, Link2, RefreshCw, Square } from "lucide-react";
import { artifactUrl, teaserRequest } from "./api";
import type { TeaserRun } from "./api";
import "./teaser.css";

export function TeaserStudio({ onBack }: { onBack: () => void }) {
  const [runs, setRuns] = useState<TeaserRun[]>([]);
  const [run, setRun] = useState<TeaserRun | null>(null);
  const [repository, setRepository] = useState("");
  const [actor, setActor] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const alive = useRef(true);
  const createKey = useRef({ repository: "", id: "" });

  function select(next: TeaserRun) {
    setRun(next);
    window.history.replaceState(null, "", `#teaser/${next.run_id}`);
    setReviewed(false);
    setNote("");
  }

  async function load() {
    const data = await teaserRequest<{ runs: TeaserRun[] }>("/api/runs");
    if (!alive.current) return;
    setRuns(data.runs);
    const selected = window.location.hash.split("/")[1];
    const current = data.runs.find(item => item.run_id === selected);
    if (current) select(current);
  }

  useEffect(() => {
    alive.current = true;
    load().catch(reason => { if (alive.current) setError(String(reason.message)); });
    return () => { alive.current = false; };
  }, []);

  async function perform(label: string, action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError("");
    try { await action(); }
    catch (reason) {
      if (alive.current) setError(reason instanceof Error ? reason.message : "Local request failed.");
    } finally {
      locked.current = false;
      if (alive.current) setBusy("");
    }
  }

  async function advance(current: TeaserRun) {
    const next = await teaserRequest<TeaserRun>(`/api/runs/${current.run_id}/advance`, {});
    if (!alive.current) return;
    select(next);
    setRuns(previous => [next, ...previous.filter(item => item.run_id !== next.run_id)]);
  }

  const terminal = run && ["complete", "failed", "cancelled"].includes(run.state);
  const subject = run?.checkpoint;
  const outputReview = subject?.subject_type === "output";

  return <section className="teaser-studio" aria-labelledby="teaser-title">
    <header className="teaser-heading">
      <button className="secondary" disabled={Boolean(busy)} onClick={onBack}><ArrowLeft size={16} />Projects</button>
      <h1 id="teaser-title">Source teaser</h1>
      <button className="secondary" disabled={Boolean(busy)} onClick={() => perform("Refreshing runs", load)}><RefreshCw size={16} />Refresh</button>
    </header>
    <p className="muted">30 seconds / 16:9 / Source quotations / No footage</p>
    {error && <div className="teaser-error" role="alert">{error}</div>}
    {busy && <p role="status">{busy}</p>}
    <form className="teaser-source" onSubmit={event => {
      event.preventDefault();
      perform("Acquiring repository and preparing storyboard", async () => {
        const url = repository.trim();
        if (createKey.current.repository !== url) {
          createKey.current = { repository: url, id: crypto.randomUUID().replaceAll("-", "") };
        }
        const created = await teaserRequest<TeaserRun>("/api/runs", {
          repository_url: url, request_id: createKey.current.id,
        });
        if (!alive.current) return;
        select(created);
        setRuns(previous => [created, ...previous.filter(item => item.run_id !== created.run_id)]);
        if (created.state === "pending") await advance(created);
      });
    }}>
      <label>Public GitHub repository<input type="url" required maxLength={300} value={repository}
        placeholder="https://github.com/owner/repository" disabled={Boolean(busy)}
        onChange={event => setRepository(event.target.value)} /></label>
      <button className="primary" disabled={Boolean(busy) || !repository.trim()}><Link2 size={16} />Prepare source teaser</button>
    </form>
    <div className="teaser-layout">
      <aside className="teaser-runs" aria-label="Server runs">
        <h2>Local runs</h2>
        {!runs.length && <p className="muted">No server runs loaded.</p>}
        {runs.map(item => <button key={item.run_id} className="teaser-run" disabled={Boolean(busy)}
          aria-pressed={run?.run_id === item.run_id} onClick={() => { select(item); setError(""); }}>
          <strong>{item.repository_url.replace("https://github.com/", "")}</strong>
          <span>{item.state.replaceAll("_", " ")}</span>
          <small>{item.run_id.slice(-8)}</small>
        </button>)}
      </aside>
      <div className="teaser-detail">
        {run ? <>
          <div className="teaser-run-heading"><h2>{run.repository_url.replace("https://github.com/", "")}</h2>
            <span>{run.state.replaceAll("_", " ")}</span></div>
          {run.error && <p className="teaser-error" role="alert">{run.error}</p>}
          {run.catalog && <p className="teaser-hash">Pinned revision <code>{run.catalog.repository.commit_sha}</code></p>}
          {run.storyboard && <section aria-label="Source-linked storyboard" className="teaser-scenes">
            {run.storyboard.scenes.map(scene => {
              const evidence = run.catalog?.evidence.find(item => item.evidence_id === scene.evidence_id);
              return <article key={scene.scene_id}>
                <div className="teaser-scene-meta"><Film size={16} /><strong>{scene.kind}</strong><span>{scene.start_frame / 30}s to {scene.end_frame / 30}s</span></div>
                <h3>{scene.text}</h3>
                <p className="muted">{scene.evidence_id}</p>
                {evidence && <details><summary>Quoted source</summary><p>{evidence.source}</p>
                  <p>Lines {evidence.line_start ?? "unknown"} to {evidence.line_end ?? "unknown"}</p>
                  <pre>{evidence.quote}</pre></details>}
              </article>;
            })}
          </section>}
          {run.preview_url && <section aria-label="Rendered video"><h2>Rendered output</h2>
            <video key={run.run_id} controls preload="metadata" src={artifactUrl(run, "preview")} />
          </section>}
          {run.state === "awaiting_approval" && subject && <section className="teaser-approval" aria-label="Server approval">
            <h2>{outputReview ? "Final output approval" : "Combined source and storyboard approval"}</h2>
            <p className="teaser-hash">Revision {subject.subject_revision}<code>{subject.subject_sha256}</code></p>
            {run.approved ? <button className="primary" disabled={Boolean(busy)} onClick={() => perform(
              outputReview ? "Publishing approved exports" : "Rendering approved storyboard", () => advance(run),
            )}><Check size={16} />{outputReview ? "Export approved output" : "Render approved storyboard"}</button> :
              <form onSubmit={event => {
                event.preventDefault();
                perform("Recording exact approval", async () => {
                  const next = await teaserRequest<TeaserRun>(`/api/runs/${run.run_id}/approve`, {
                    subject, actor, note, reviewed,
                  });
                  if (alive.current) {
                    select(next);
                    setRuns(previous => previous.map(item => item.run_id === next.run_id ? next : item));
                  }
                });
              }}>
                <label>Reviewer<input required maxLength={100} disabled={Boolean(busy)} value={actor} onChange={event => setActor(event.target.value)} /></label>
                <label>Review note<textarea required maxLength={2000} disabled={Boolean(busy)} value={note} onChange={event => setNote(event.target.value)} /></label>
                <label className="teaser-consent"><input type="checkbox" checked={reviewed} disabled={Boolean(busy)} onChange={event => setReviewed(event.target.checked)} />
                  {outputReview ? "I reviewed the entire rendered video, including text, motion and privacy." : "I reviewed all three scenes and their source quotations. This is not a runtime product demonstration."}</label>
                <button className="primary" disabled={Boolean(busy) || !reviewed || !actor.trim() || !note.trim()}><Check size={16} />{outputReview ? "Approve final output" : "Approve source storyboard"}</button>
              </form>}
          </section>}
          {!terminal && run.state !== "awaiting_approval" && <button className="primary" disabled={Boolean(busy)} onClick={() => perform("Continuing run", () => advance(run))}>Continue run</button>}
          {run.state === "complete" && <section aria-label="Approved downloads"><h2>Approved downloads</h2><div className="teaser-downloads">
            {Object.keys(run.downloads).map(identity => <a key={identity} className="secondary" href={artifactUrl(run, identity)} download><Download size={16} />{({ video: "Video", evidence: "Evidence JSON", review: "Review HTML", bundle: "Offline review bundle" } as Record<string, string>)[identity]}</a>)}
          </div></section>}
          {!terminal && <button className="secondary" disabled={Boolean(busy)} onClick={() => perform("Cancelling run", async () => {
            const next = await teaserRequest<TeaserRun>(`/api/runs/${run.run_id}/cancel`, {});
            if (alive.current) { select(next); await load(); }
          })}><Square size={16} />Cancel run</button>}
        </> : <p className="muted">No run selected.</p>}
      </div>
    </div>
  </section>;
}