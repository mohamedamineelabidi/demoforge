import { useEffect, useRef, useState } from "react";
import { CircleAlert, FileJson, Link2, Trash2, Upload } from "lucide-react";
import { readImport, reportAssociation } from "./imports";
import type { Catalog, ImportedArtifacts, QualityReport } from "./imports";
import "./artifacts.css";

function ImportControl({ kind, onImport }: {
  kind: "catalog" | "report"; onImport: (value: ImportedArtifacts) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  const title = kind === "catalog" ? "evidence catalog" : "quality report";
  return <div className="artifact-import" aria-busy={busy}>
    <label className="checkbox-row"><input type="checkbox" checked={confirmed} onChange={event => {
      setConfirmed(event.target.checked); request.current += 1; setBusy(false);
    }} /><span>I confirm this {title} is sanitized and safe to display.</span></label>
    <div className="artifact-import-actions"><label className={`artifact-file ${!confirmed || busy ? "disabled" : ""}`}>
      <Upload size={16} /><span>{busy ? "Reading file..." : `Import ${title}`}</span>
      <input aria-label={`Import ${title}`} type="file" accept=".json,application/json" disabled={!confirmed || busy} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        const current = ++request.current;
        setBusy(true); setError(""); setNotice("");
        try {
          const value = await readImport(file, kind);
          if (request.current !== current) return;
          onImport(value); setNotice("Imported for this session. Not verified or approved by the backend.");
        } catch (failure) {
          if (request.current === current) setError(failure instanceof Error ? failure.message : "Import failed.");
        } finally { if (request.current === current) setBusy(false); }
      }} />
    </label><span>JSON / version 1 / up to 2 MB</span></div>
    {error && <p className="artifact-error" role="alert"><CircleAlert size={16} />{error}</p>}
    {notice && <p role="status" className="artifact-note">{notice}</p>}
  </div>;
}

export function CatalogPanel({ catalog, repository, onImport, onRemove }: {
  catalog?: Catalog; repository: string; onImport: (value: ImportedArtifacts) => void; onRemove: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("");
  const claims = catalog?.claims.filter(claim => `${claim.text} ${claim.claim_id}`.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const claim = claims.find(item => item.claim_id === selected) ?? claims[0];
  return <section className="artifact-panel" aria-label="Imported evidence catalog">
    <ImportControl key={catalog ? "loaded" : "empty"} kind="catalog" onImport={onImport} />
    {!catalog ? <div className="inline-empty"><Link2 size={25} /><h3>No imported catalog</h3><p>No revision-pinned sources are loaded.</p></div> : <>
      <header className="artifact-heading"><div><h3>{catalog.repository.full_name}</h3><p className="mono">{catalog.catalog_id} / revision {catalog.revision}</p></div><button className="secondary" onClick={onRemove}><Trash2 size={15} />Remove catalog</button></header>
      <p className="artifact-note">Imported snapshot only. Repository hashes and source content have not been independently verified.</p>
      {repository && repository.replace(/\/$/, "") !== catalog.repository.repo_url.replace(/\/$/, "") && <p className="artifact-warning" role="status">Repository reference differs from this draft. No automatic project association or claim linking was performed.</p>}
      <dl className="artifact-facts"><dt>Repository</dt><dd>{catalog.repository.repo_url}</dd><dt>Commit SHA</dt><dd className="mono">{catalog.repository.commit_sha}</dd><dt>Acquired</dt><dd>{catalog.repository.acquired_at}</dd><dt>License</dt><dd>{catalog.repository.license ?? "Unknown"}</dd></dl>
      <div className="imported-evidence-layout"><div className="imported-claims"><label>Find an imported claim<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label><p className="artifact-note">{claims.length} claims / {catalog.evidence.length} evidence records</p>
        {claims.map(item => <button className="imported-claim" key={item.claim_id} aria-pressed={item.claim_id === claim?.claim_id} onClick={() => setSelected(item.claim_id)}><span className="mono">{item.claim_id}</span><strong>{item.text}</strong><span>{item.verification_status.replaceAll("_", " ")}</span></button>)}
        {!claims.length && <p className="artifact-note">No matching claims.</p>}
      </div><div className="imported-source">
        {claim ? <><h3>{claim.text}</h3><p className="artifact-note">Claim revision {claim.revision} / Reported status: {claim.verification_status.replaceAll("_", " ")}</p><p className="artifact-warning">Human approval: not available. Imported support is not proof of truth.</p>
          {claim.limitations.length > 0 && <><h4>Limitations</h4><ul>{claim.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
          {claim.evidence_ids.map(id => { const evidence = catalog.evidence.find(item => item.evidence_id === id)!; return <article className="evidence-record" key={id}><h4><FileJson size={16} />{id}</h4><dl><dt>Kind</dt><dd>{evidence.kind}</dd><dt>Source</dt><dd>{evidence.source}</dd><dt>Lines</dt><dd>{evidence.line_start === null ? "Not specified" : `${evidence.line_start} - ${evidence.line_end}`}</dd><dt>Revision</dt><dd className="mono">{evidence.revision ?? "Not specified"}</dd><dt>Content SHA-256</dt><dd className="mono">{evidence.content_sha256}</dd><dt>Observation ID</dt><dd>{evidence.observation_id ?? "None"}</dd><dt>Attestation ID</dt><dd>{evidence.attestation_id ?? "None"}</dd></dl><blockquote>{evidence.quote}</blockquote></article>; })}
        </> : <p className="artifact-note">No claim selected.</p>}
      </div></div>
    </>}
  </section>;
}

export function ReportPanel({ report, catalog, onImport, onRemove }: {
  report?: QualityReport; catalog?: Catalog; onImport: (value: ImportedArtifacts) => void; onRemove: () => void;
}) {
  const association = report ? reportAssociation(report, catalog) : null;
  return <section className="artifact-panel" aria-label="Imported quality report"><h3>Imported quality report</h3>
    <ImportControl key={report ? "loaded" : "empty"} kind="report" onImport={onImport} />
    {!report ? <p className="artifact-note">No report loaded. Backend checks have not run in this browser.</p> : <>
      <header className="artifact-heading"><div><h3>{report.report_id}</h3><p className="mono">Subject: {report.subject_id} / revision {report.subject_revision}</p></div><button className="secondary" onClick={onRemove}><Trash2 size={15} />Remove report</button></header>
      <p className="artifact-warning" role="status">{association === "matching" ? "Matches imported catalog ID and revision. Not associated with a rendered artifact or local draft approval." : association === "stale" ? "Stale report: subject revision differs from the imported catalog." : "Unassociated report: no matching imported catalog subject."}</p>
      <p className="artifact-note">Reported gate: <strong>{report.gate.replaceAll("_", " ")}</strong>. Importing a report does not authorize export.</p>
      {report.checks.length === 0 && <p className="artifact-warning">No check results supplied. Required gate coverage is unknown.</p>}
      <div className="imported-checks">{report.checks.map(check => <div className="check-row" key={check.check_id}><div><strong>{check.check_id}</strong><small>{check.required ? "Required" : "Optional"} / {check.reason ?? "No reason supplied"}</small></div><span className={`badge ${check.status === "pass" ? "green" : "amber"}`}>{check.status.replaceAll("_", " ")}</span></div>)}</div>
      {([['Missing inputs', report.missing_inputs], ['Questions', report.questions], ['Warnings', report.warnings]] as const).map(([title, items]) => items.length > 0 && <div key={title}><h4>{title}</h4><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
      <p className="artifact-note">Measurements are retained in memory but not displayed. The complete required gate set must be checked by the backend.</p>
    </>}
  </section>;
}