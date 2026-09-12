import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, CircleAlert, Clapperboard, Copy, FileCheck2, Film, Trash2, Upload, X } from "lucide-react";
import { timeline } from "../model";
import type { Project } from "../model";
import type { Catalog } from "../evidence/imports";
import { createApproval } from "./schema";
import type { Approval } from "./schema";
import {
  approvalMatches, canonicalSnapshot, claimsSubject, currentDecisions,
  hashSnapshot, OutputSession, storyboardSubject,
} from "./subjects";
import type { HashedSubject, ReviewSubject, SelectedOutput, SubjectIdentity } from "./subjects";
import "./approvals.css";

export type { Approval } from "./schema";

export type ApprovalReviewProps = {
  project: Project;
  catalog?: Catalog;
  drafts: readonly Approval[];
  onDecision: (approval: Approval) => void;
  disabled?: boolean;
};

function useSubjectHash(subject: ReviewSubject | null) {
  const key = subject ? canonicalSnapshot(subject) : "";
  const [result, setResult] = useState({ key: "", hash: "", error: "" });
  useEffect(() => {
    let active = true;
    if (key) {
      const snapshot = (JSON.parse(key) as ReviewSubject).snapshot;
      hashSnapshot(snapshot).then(hash => {
        if (active) setResult({ key, hash, error: "" });
      }).catch(() => {
        if (active) setResult({ key, hash: "", error: "SHA-256 unavailable. Decisions are blocked." });
      });
    }
    return () => { active = false; };
  }, [key]);
  const hash = key && result.key === key ? result.hash : "";
  const ready: HashedSubject | null = subject && hash ? {
    run_id: subject.run_id, subject_type: subject.subject_type,
    subject_id: subject.subject_id, subject_revision: subject.subject_revision,
    subject_sha256: hash,
  } : null;
  return { ready, error: key && result.key === key ? result.error : "" };
}

function HashValue({ hash }: { hash: string }) {
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return <div className="approval-hash">
    <div className="approval-hash-line"><code title={hash}>{hash.slice(0, 12)}...{hash.slice(-8)}</code>
      <button type="button" aria-label="Copy full SHA-256" title="Copy full SHA-256" disabled={copying} onClick={async () => {
        setCopying(true); setNotice("");
        try {
          if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText(hash);
          if (mounted.current) setNotice("SHA-256 copied.");
        } catch {
          if (mounted.current) setNotice("Copy failed. Full SHA-256 is available below.");
        } finally { if (mounted.current) setCopying(false); }
      }}><Copy size={16} aria-hidden="true" /></button></div>
    <details><summary>Full SHA-256</summary><code>{hash}</code></details>
    {notice && <span role="status">{notice}</span>}
  </div>;
}

type SubjectCardProps = {
  title: string;
  icon: ReactNode;
  type: Approval["subject_type"];
  identity: SubjectIdentity | null;
  subject: HashedSubject | null;
  reason: string;
  actor: string;
  drafts: readonly Approval[];
  onDecision: (approval: Approval) => void;
  disabled?: boolean;
  children: ReactNode;
};

function SubjectCard({ title, icon, type, identity, subject, reason, actor, drafts, onDecision, disabled, children }: SubjectCardProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submitted = useRef("");
  const noteId = useId();
  const reasonId = useId();
  const current = currentDecisions(drafts, subject);
  const latest = current.at(-1);
  const blocked = Boolean(disabled || reason || !subject || !actor.trim());
  function decide(decision: Approval["decision"]) {
    if (blocked || !subject || (decision === "rejected" && !note.trim())) return;
    const key = canonicalSnapshot({ subject, actor: actor.trim(), decision, note: note.trim() });
    if (submitted.current === key) return;
    try {
      const approval = createApproval({ ...subject, actor_id: actor, decision, note: note || null });
      submitted.current = key;
      onDecision(approval);
      setError("");
    } catch {
      submitted.current = "";
      setError("The local decision could not be recorded. Review the inputs and try again.");
    }
  }
  return <article className="approval-subject" aria-label={`${title} review`}>
    <header className="approval-subject-heading"><div>{icon}<h3>{title}</h3></div>
      <span className="approval-local-status">{latest ? `${latest.decision === "approved" ? "Approved" : "Rejected"} locally` : "Local review"}</span>
    </header>
    <dl className="approval-identity">
      <dt>Type</dt><dd><code>{type}</code></dd>
      <dt>Subject ID</dt><dd><code>{identity?.subject_id ?? "Unavailable"}</code></dd>
      <dt>Revision</dt><dd>{identity?.subject_revision ?? "Unavailable"}</dd>
      <dt>SHA-256</dt><dd>{subject ? <HashValue key={subject.subject_sha256} hash={subject.subject_sha256} /> : identity ? "SHA-256 pending" : "Unavailable"}</dd>
    </dl>
    <div className="approval-subject-content">{children}</div>
    <div className="approval-decision-form">
      <label htmlFor={noteId}>Review note <span>(required to reject)</span></label>
      <textarea id={noteId} value={note} disabled={disabled} rows={2} onChange={event => { setNote(event.target.value); setError(""); }} />
      <p id={reasonId} className="approval-blocker" role="status">{disabled ? "Decisions are disabled by the workspace." : reason || (!subject ? "Computing SHA-256. Decisions are blocked." : !actor.trim() ? "Enter an operator label to record a decision." : "Not sent, local draft")}</p>
      <div className="approval-decision-actions">
        <button type="button" className="approval-approve" disabled={blocked} aria-describedby={reasonId} onClick={() => decide("approved")}><Check size={16} aria-hidden="true" />Approve locally</button>
        <button type="button" className="approval-reject" disabled={blocked || !note.trim()} aria-describedby={`${reasonId} ${noteId}`} onClick={() => decide("rejected")}><X size={16} aria-hidden="true" />Reject locally</button>
      </div>
      {error && <p role="alert" className="approval-error">{error}</p>}
    </div>
    {drafts.length > 0 && <details className="approval-records"><summary>Local decisions ({drafts.length})</summary>
      <ol>{drafts.map((approval, index) => <li key={`${approval.approval_id}:${index}`}>
        <div className="approval-record-heading"><strong>{approval.decision === "approved" ? "Approved locally" : "Rejected locally"}</strong>
          <span>{approvalMatches(approval, subject) ? approval === latest ? "Current snapshot / latest local decision" : "Current snapshot / earlier local decision" : "Stale / local only"}</span></div>
        <dl><dt>Subject</dt><dd><code>{approval.subject_type} / {approval.subject_id}</code></dd>
          <dt>Revision</dt><dd>{approval.subject_revision}</dd>
          <dt>SHA-256</dt><dd><HashValue key={approval.subject_sha256} hash={approval.subject_sha256} /></dd>
          <dt>Operator</dt><dd>{approval.actor_id}</dd>
          <dt>Decided at</dt><dd><time dateTime={approval.decided_at}>{approval.decided_at}</time></dd>
          <dt>Decision ID</dt><dd><code>{approval.approval_id}</code></dd>
          <dt>Note</dt><dd>{approval.note ?? "No note"}</dd></dl>
        <p className="approval-muted">Not sent, local draft</p>
      </li>)}</ol>
    </details>}
  </article>;
}

function ClaimContent({ catalog }: { catalog?: Catalog }) {
  if (!catalog?.claims.length) return <p className="approval-muted">No imported claims catalog. Claims cannot be reviewed yet.</p>;
  return <><p className="approval-muted">Imported catalog {catalog.catalog_id}. Reported support is not proof of truth.</p>
    <ul className="approval-claims">{catalog.claims.map(claim => <li key={claim.claim_id}>
      <div className="approval-claim-heading"><code>{claim.claim_id}</code><span>Revision {claim.revision} / {claim.verification_status.replaceAll("_", " ")}</span></div>
      <p>{claim.text}</p>
      {claim.limitations.length > 0 && <div><strong>Limitations</strong><ul>{claim.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></div>}
      <details><summary>Evidence references ({claim.evidence_ids.length})</summary>
        {claim.evidence_ids.map(evidenceId => {
          const evidence = catalog.evidence.find(item => item.evidence_id === evidenceId);
          return <div className="approval-evidence" key={evidenceId}><code>{evidenceId}</code>
            {evidence ? <><p>{evidence.kind} / {evidence.source}</p>
              <p className="approval-muted">Revision: <code>{evidence.revision ?? "Not supplied"}</code><br />Lines: {evidence.line_start === null ? "Not supplied" : `${evidence.line_start} - ${evidence.line_end}`}</p>
              <blockquote>{evidence.quote}</blockquote></> : <p className="approval-error">Missing evidence reference</p>}
          </div>;
        })}
      </details>
    </li>)}</ul></>;
}

function StoryboardContent({ project, catalog }: { project: Project; catalog?: Catalog }) {
  return <><p className="approval-muted">30 fps / frame ranges [start, end) / local storyboard</p>
    <ol className="approval-scenes">{timeline(project.scenes).map(scene => {
      const claim = catalog?.claims.find(item => item.claim_id === scene.claimId);
      return <li key={scene.id}><div className="approval-scene-heading"><strong>{scene.title}</strong><code>[{scene.start}, {scene.end})</code></div>
        <p className="approval-muted"><code>{scene.id}</code> / source [{scene.trimIn}, {scene.trimIn + scene.frames}) / zoom {scene.zoom}</p>
        <p className="approval-muted">Highlight: {scene.highlight} / Clip: {scene.footageClipRef || "Not linked"}</p>
        <p>{scene.caption || "No caption"}</p>
        <p className="approval-muted">Claim: <code>{scene.claimId || "Not linked"}</code></p>
        {claim && <><p>{claim.text}</p><p className="approval-muted">Evidence: <code>{claim.evidence_ids.join(", ")}</code></p></>}
        {scene.claimId && !claim && <p className="approval-error">Claim reference is missing from the imported catalog.</p>}
      </li>;
    })}</ol></>;
}

function OutputReview({ project, catalog, drafts, onDecision, disabled, actor }: ApprovalReviewProps & { actor: string }) {
  const [session] = useState(() => new OutputSession());
  const [selection, setSelection] = useState<(SelectedOutput & { revision: number }) | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [privateSafe, setPrivateSafe] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; session.clear(); }, [session]);
  function clear() {
    request.current += 1; session.clear(); setSelection(null); setBusy(false);
    setReady(false); setReviewed(false); setError("");
  }
  const identity: HashedSubject | null = selection ? {
    run_id: `local:${project.id}`, subject_type: "output",
    subject_id: `local:${project.id}:output:${selection.sha256}`,
    subject_revision: selection.revision, subject_sha256: selection.sha256,
  } : null;
  const stale = selection !== null && selection.revision !== project.revision;
  const reason = !catalog?.claims.length ? "An imported claims catalog is required before a local decision."
    : busy ? "Reading and hashing local bytes. Decisions are blocked."
      : error || (!selection ? "No final MP4 selected."
        : stale ? "Storyboard revision changed. Reattach the output for a new local review."
          : !authorized || !privateSafe ? "Authorization and privacy confirmation are required."
            : !ready ? "Waiting for browser playback readiness."
              : !reviewed ? "Full output review confirmation is required." : "");
  return <SubjectCard title="Final output" icon={<Film size={20} aria-hidden="true" />} type="output"
    identity={identity} subject={stale ? null : identity} reason={reason} actor={actor}
    drafts={drafts} onDecision={onDecision} disabled={disabled}>
    <div className="approval-output-controls" aria-busy={busy}>
      <label className="approval-checkbox"><input type="checkbox" checked={authorized} disabled={disabled} onChange={event => { clear(); setAuthorized(event.target.checked); }} /><span>I am authorized to use this supplied final MP4.</span></label>
      <label className="approval-checkbox"><input type="checkbox" checked={privateSafe} disabled={disabled} onChange={event => { clear(); setPrivateSafe(event.target.checked); }} /><span>I confirm this file is safe to display and contains no unapproved private information.</span></label>
      <label className="approval-file"><span><Upload size={16} aria-hidden="true" />Select local final MP4</span>
        <input aria-label="Select local final MP4" type="file" accept=".mp4,video/mp4" disabled={disabled || !authorized || !privateSafe} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          clear(); const current = ++request.current; const revision = project.revision;
          setBusy(true);
          try {
            const output = await session.select(file);
            if (current === request.current && output) setSelection({ ...output, revision });
          } catch {
            if (current === request.current) setError("Could not read this MP4. Use a nonempty local MP4 up to 128 MiB in a browser with SHA-256 support.");
          } finally { if (current === request.current) setBusy(false); }
        }} />
      </label>
      <p className="approval-muted">MP4 / maximum 128 MiB / session only</p>
      {(selection || busy) && <button type="button" className="approval-remove" onClick={clear}><Trash2 size={16} aria-hidden="true" />{busy ? "Cancel selection" : "Remove output"}</button>}
      {error && <p role="alert" className="approval-error"><CircleAlert size={16} aria-hidden="true" />{error}</p>}
      {selection && authorized && privateSafe ? <>
        <div className="approval-video"><video key={selection.url} aria-label="Supplied final output preview" controls preload="metadata" playsInline src={selection.url}
          onLoadedData={() => { if (session.current?.url === selection.url) setReady(true); }}
          onCanPlay={() => { if (session.current?.url === selection.url) setReady(true); }}
          onError={() => { if (session.current?.url === selection.url) { setReady(false); setReviewed(false); setError("Browser playback failed. This file cannot be approved locally."); } }} /></div>
        <p className="approval-muted">{selection.name} / {selection.size.toLocaleString()} bytes</p>
        <label className="approval-checkbox"><input type="checkbox" checked={reviewed} disabled={disabled || !ready || stale || Boolean(error)} onChange={event => setReviewed(event.target.checked)} /><span>I have reviewed the entire supplied output, including motion and privacy.</span></label>
      </> : <p className="approval-muted">{busy ? "Computing the actual file SHA-256..." : "No final MP4 selected."}</p>}
      <p className="approval-boundary">Supplied file only, not a DemoForge render. Browser playback and local confirmations do not pass media or backend checks. Export remains unavailable.</p>
    </div>
  </SubjectCard>;
}

function ApprovalReviewSession({ project, catalog, drafts, onDecision, disabled }: ApprovalReviewProps) {
  const [actor, setActor] = useState("");
  const actorId = useId();
  const claims = claimsSubject(project, catalog);
  const storyboard = storyboardSubject(project, catalog);
  const claimsHash = useSubjectHash(claims);
  const storyboardHash = useSubjectHash(storyboard);
  const localDrafts = drafts.filter(approval => approval.run_id === `local:${project.id}`);
  return <section className="approval-review" aria-label="Local approval review">
    <header className="approval-review-heading"><div><h2>Approval review</h2><p className="approval-muted">Not sent, local draft</p></div><span className="approval-local-status">Local only</span></header>
    <p className="approval-boundary">These decisions are not server approvals. Evidence truth, technical checks and export eligibility are unchanged.</p>
    <div className="approval-operator"><label htmlFor={actorId}>Operator label</label><input id={actorId} type="text" autoComplete="off" value={actor} disabled={disabled} onChange={event => setActor(event.target.value)} /><p className="approval-muted">Explicit local label, not authenticated identity.</p></div>
    <p className="approval-run">Run <code>local:{project.id}</code></p>
    <ol className="approval-subjects">
      <li><SubjectCard title="Claims" icon={<FileCheck2 size={20} aria-hidden="true" />} type="claims" identity={claims} subject={claimsHash.ready}
        reason={!claims ? "No imported claims catalog. Import nonempty claims before review." : claimsHash.error}
        actor={actor} drafts={localDrafts.filter(approval => approval.subject_type === "claims")} onDecision={onDecision} disabled={disabled}><ClaimContent catalog={catalog} /></SubjectCard></li>
      <li><SubjectCard title="Storyboard" icon={<Clapperboard size={20} aria-hidden="true" />} type="storyboard" identity={storyboard} subject={storyboardHash.ready}
        reason={!storyboard ? "A claims catalog, local scenes and resolved claim references are required." : storyboardHash.error}
        actor={actor} drafts={localDrafts.filter(approval => approval.subject_type === "storyboard")} onDecision={onDecision} disabled={disabled}><StoryboardContent project={project} catalog={catalog} /></SubjectCard></li>
      <li><OutputReview project={project} catalog={catalog} drafts={localDrafts.filter(approval => approval.subject_type === "output")} actor={actor} onDecision={onDecision} disabled={disabled} /></li>
    </ol>
  </section>;
}

export function ApprovalReview(props: ApprovalReviewProps) {
  return <ApprovalReviewSession key={props.project.id} {...props} />;
}