import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CircleAlert, FilePlus2, GitBranch } from "lucide-react";
import { BRIEF_LIMITS, parseGithubUrl } from "../entry/schemas";
import { prepareRepositoryDraft } from "./validation";
import type { SourceDraftInput, SourceEntryErrors } from "./validation";
import "./repository-entry.css";

export type RepositoryEntryProps = {
  onCreate: (input: SourceDraftInput) => boolean | void;
  onCancel: () => void;
  disabled?: boolean;
  initialRepository?: string;
};

export function RepositoryEntry({
  onCreate,
  onCancel,
  disabled = false,
  initialRepository = "",
}: RepositoryEntryProps) {
  const base = useId();
  const [repository, setRepository] = useState(initialRepository);
  const [brief, setBrief] = useState("");
  const [commit, setCommit] = useState("");
  const [errors, setErrors] = useState<SourceEntryErrors>({});
  const [saveError, setSaveError] = useState("");
  const [locked, setLocked] = useState(false);
  const submissionLock = useRef(false);
  const repositoryRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const commitRef = useRef<HTMLInputElement>(null);
  const saveErrorRef = useRef<HTMLParagraphElement>(null);
  const parsed = parseGithubUrl(repository);
  const unavailable = disabled || locked;

  function edit(field: keyof SourceEntryErrors, value: string) {
    if (unavailable || submissionLock.current) return;
    if (field === "url") setRepository(value);
    if (field === "brief") setBrief(value);
    if (field === "commit") setCommit(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unavailable || submissionLock.current) return;
    setSaveError("");
    const result = prepareRepositoryDraft(repository, brief, commit);
    if (!result.success) {
      setErrors(result.errors);
      const firstInvalid = result.errors.url
        ? repositoryRef
        : result.errors.brief ? briefRef : commitRef;
      firstInvalid.current?.focus();
      return;
    }
    setErrors({});
    submissionLock.current = true;
    setLocked(true);
    let accepted = false;
    try {
      accepted = onCreate(result.input) !== false;
    } catch {
      accepted = false;
    }
    if (!accepted) {
      submissionLock.current = false;
      setLocked(false);
      setSaveError("The source draft could not be saved. Your inputs are still here. Try again.");
    }
  }

  return (
    <section className="source-entry" aria-labelledby={`${base}-title`}>
      <header className="source-entry-header">
        <GitBranch size={24} aria-hidden="true" />
        <h1 id={`${base}-title`}>Source-only draft</h1>
      </header>
      <p className="source-entry-state" id={`${base}-state`}>
        No repository fetched. No footage or generation yet.
      </p>
      <form onSubmit={submit} noValidate aria-describedby={`${base}-state`}>
        <fieldset disabled={unavailable}>
          <legend className="source-entry-legend">Repository source</legend>
          <div className="source-entry-field source-entry-url">
            <label htmlFor={`${base}-url`}>Public GitHub repository URL</label>
            <input
              ref={repositoryRef}
              id={`${base}-url`}
              type="url"
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://github.com/owner/repo"
              value={repository}
              onChange={(event) => edit("url", event.target.value)}
              aria-invalid={Boolean(errors.url)}
              aria-describedby={`${base}-name${errors.url ? ` ${base}-url-error` : ""}`}
            />
            <p className="source-entry-name" id={`${base}-name`}>
              {parsed ? <>Project name: <strong>{parsed.repo}</strong></> : "Project name pending"}
            </p>
            {errors.url && <p className="source-entry-error" id={`${base}-url-error`} role="alert">
              <CircleAlert size={16} aria-hidden="true" />{errors.url}
            </p>}
          </div>
          <div className="source-entry-field">
            <label htmlFor={`${base}-brief`}>Feature brief <span>(optional)</span></label>
            <textarea
              ref={briefRef}
              id={`${base}-brief`}
              rows={3}
              value={brief}
              onChange={(event) => edit("brief", event.target.value)}
              aria-invalid={Boolean(errors.brief)}
              aria-describedby={`${base}-brief-count${errors.brief ? ` ${base}-brief-error` : ""}`}
            />
            <p className="source-entry-count" id={`${base}-brief-count`}>
              {brief.trim().length}/{BRIEF_LIMITS.changed} characters
            </p>
            {errors.brief && <p className="source-entry-error" id={`${base}-brief-error`} role="alert">
              <CircleAlert size={16} aria-hidden="true" />{errors.brief}
            </p>}
          </div>
          <div className="source-entry-field">
            <label htmlFor={`${base}-commit`}>Full commit SHA <span>(optional)</span></label>
            <input
              ref={commitRef}
              id={`${base}-commit`}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={commit}
              onChange={(event) => edit("commit", event.target.value)}
              aria-invalid={Boolean(errors.commit)}
              aria-describedby={errors.commit ? `${base}-commit-error` : undefined}
            />
            {errors.commit && <p className="source-entry-error" id={`${base}-commit-error`} role="alert">
              <CircleAlert size={16} aria-hidden="true" />{errors.commit}
            </p>}
          </div>
        </fieldset>
        {saveError && <p
          ref={(node) => {
            saveErrorRef.current = node;
            node?.focus();
          }}
          className="source-entry-error"
          role="alert"
          tabIndex={-1}
        >
          <CircleAlert size={16} aria-hidden="true" />{saveError}
        </p>}
        <footer className="source-entry-actions">
          <button type="button" disabled={unavailable} onClick={onCancel}>
            <ArrowLeft size={16} aria-hidden="true" />Cancel
          </button>
          <button type="submit" disabled={unavailable} className="source-entry-create">
            <FilePlus2 size={16} aria-hidden="true" />Create source draft
          </button>
        </footer>
      </form>
    </section>
  );
}