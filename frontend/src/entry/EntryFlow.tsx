import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Clapperboard,
  FileCode2,
  Film,
  Link2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  acceptsFootage,
  attestationSchema,
  BRIEF_LIMITS,
  briefSchema,
  firstIssue,
  formatBytes,
  formatDuration,
  lintBrief,
  parseGithubUrl,
  repositorySchema,
} from "./schemas";
import type { BriefInput, FootageMeta, RepositoryInput } from "./schemas";

export type EntryResult = {
  repository: RepositoryInput;
  brief: BriefInput;
  footage: {
    file: File;
    url: string;
    meta: FootageMeta;
    actor: string;
    authorized: true;
  };
};

const STEPS = [
  { key: "repository", label: "Repository", icon: FileCode2 },
  { key: "brief", label: "Brief", icon: Link2 },
  { key: "footage", label: "Footage", icon: Film },
  { key: "review", label: "Review", icon: ShieldCheck },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export function EntryLanding({
  onStart,
  disabled,
}: {
  onStart: () => void;
  disabled?: boolean;
}) {
  return (
    <section className="entry-landing" aria-labelledby="entry-landing-title">
      <span className="entry-brand-icon" aria-hidden="true">
        <Clapperboard size={26} strokeWidth={1.5} />
      </span>
      <p className="eyebrow">DEMOFORGE</p>
      <h1 id="entry-landing-title">
        Turn a shipped feature, a brief and your own footage into a 30-second
        source-linked demo video.
      </h1>
      <p className="entry-landing-note">
        Three inputs: a public GitHub repository, a short feature brief and
        footage you are authorized to use. Everything stays in this browser
        until you start the pipeline yourself.
      </p>
      <button
        className="primary entry-cta"
        disabled={disabled}
        onClick={onStart}
        data-testid="entry-new-project"
      >
        New project
        <ArrowRight size={17} />
      </button>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: ReactNode;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`entry-field ${error ? "has-error" : ""}`}>
      <div className="entry-field-head">
        <label htmlFor={id}>{label}</label>
        {counter}
      </div>
      {children(describedBy)}
      {hint && (
        <p className="entry-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="entry-error" id={errorId} role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span
      className={`entry-counter ${over ? "over" : ""}`}
      aria-live="polite"
    >
      {value}/{max}
    </span>
  );
}

function LintList({ text, id }: { text: string; id: string }) {
  const issues = lintBrief(text);
  if (!issues.length) return null;
  return (
    <ul className="entry-lint" id={id} aria-label="Wording suggestions">
      {issues.map((issue, index) => (
        <li key={`${issue.kind}-${issue.index}-${index}`}>
          <CircleAlert size={14} aria-hidden="true" />
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

export function EntryFlow({
  onCancel,
  onComplete,
  disabled,
}: {
  onCancel: () => void;
  onComplete: (result: EntryResult) => boolean;
  disabled?: boolean;
}) {
  const base = useId();
  const [step, setStep] = useState<StepKey>("repository");
  const [repository, setRepository] = useState<RepositoryInput>({
    url: "",
    commit: "",
  });
  const [brief, setBrief] = useState<BriefInput>({
    name: "",
    changed: "",
    audience: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<FootageMeta>({
    duration: null,
    width: null,
    height: null,
  });
  const [metaState, setMetaState] = useState<"idle" | "loading" | "ready" | "failed">(
    "idle",
  );
  const [authorized, setAuthorized] = useState(false);
  const [actor, setActor] = useState("");
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const urlRef = useRef(url);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const parsedRepo = parseGithubUrl(repository.url);
  const stepIndex = STEPS.findIndex((item) => item.key === step);

  function go(next: StepKey) {
    setErrors({});
    setStep(next);
  }
  function submitRepository() {
    const result = repositorySchema.safeParse(repository);
    const next = firstIssue(result);
    setErrors(next);
    if (result.success) {
      setRepository(result.data);
      go("brief");
    }
  }
  function submitBrief() {
    const result = briefSchema.safeParse(brief);
    const next = firstIssue(result);
    setErrors(next);
    if (result.success) {
      setBrief(result.data);
      go("footage");
    }
  }
  function submitFootage() {
    const result = attestationSchema.safeParse({
      hasFile: file !== null,
      authorized,
      actor,
    });
    const next = firstIssue(result);
    setErrors(next);
    if (result.success) {
      setActor(result.data.actor);
      go("review");
    }
  }
  function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    const problem = acceptsFootage(candidate);
    if (problem) {
      setErrors({ hasFile: problem });
      return;
    }
    if (url) URL.revokeObjectURL(url);
    setErrors({});
    setFile(candidate);
    setUrl(URL.createObjectURL(candidate));
    setMeta({ duration: null, width: null, height: null });
    setMetaState("loading");
  }
  function clearFile() {
    if (url) URL.revokeObjectURL(url);
    setUrl("");
    setFile(null);
    setMeta({ duration: null, width: null, height: null });
    setMetaState("idle");
    if (fileInput.current) fileInput.current.value = "";
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }
  function finish() {
    if (!file || !url || !authorized) return;
    const ok = onComplete({
      repository,
      brief,
      footage: { file, url, meta, actor, authorized: true },
    });
    if (ok) {
      // Ownership of the object URL moves to the workspace media store.
      urlRef.current = "";
    }
  }

  const ids = {
    url: `${base}-url`,
    commit: `${base}-commit`,
    name: `${base}-name`,
    changed: `${base}-changed`,
    audience: `${base}-audience`,
    file: `${base}-file`,
    actor: `${base}-actor`,
    authorized: `${base}-authorized`,
    lint: `${base}-lint`,
  };

  return (
    <section className="entry-flow" aria-labelledby={`${base}-title`}>
      <div className="entry-flow-head">
        <div>
          <p className="eyebrow">NEW PROJECT</p>
          <h1 id={`${base}-title`} ref={headingRef} tabIndex={-1}>
            {STEPS[stepIndex].label}
          </h1>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          aria-label="Cancel new project"
        >
          <X size={16} />
          Cancel
        </button>
      </div>
      <ol className="entry-stepper" aria-label="Creation steps">
        {STEPS.map((item, index) => {
          const state =
            index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
          return (
            <li
              key={item.key}
              className={`entry-step ${state}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="entry-step-mark" aria-hidden="true">
                {state === "done" ? <Check size={14} /> : index + 1}
              </span>
              <span className="entry-step-label">
                <item.icon size={14} aria-hidden="true" />
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === "repository" && (
        <form
          className="entry-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submitRepository();
          }}
        >
          <p className="entry-intro">
            The public repository that shipped the feature. Evidence links in
            the video point back to files in this repository.
          </p>
          <Field
            id={ids.url}
            label="GitHub repository URL"
            hint="Form: https://github.com/owner/repo"
            error={errors.url}
          >
            {(describedBy) => (
              <input
                id={ids.url}
                name="url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://github.com/owner/repo"
                value={repository.url}
                aria-describedby={describedBy}
                aria-invalid={errors.url ? true : undefined}
                onChange={(event) =>
                  setRepository({ ...repository, url: event.target.value })
                }
                autoFocus
              />
            )}
          </Field>
          <p className="entry-parsed mono" aria-live="polite">
            {parsedRepo ? (
              <>
                <Check size={14} aria-hidden="true" />
                {parsedRepo.owner} / {parsedRepo.repo}
              </>
            ) : (
              <span className="muted">owner / repo will appear here</span>
            )}
          </p>
          <Field
            id={ids.commit}
            label="Commit SHA (optional)"
            hint="40 hexadecimal characters. Leave empty to use the default branch head when the pipeline runs."
            error={errors.commit}
          >
            {(describedBy) => (
              <input
                id={ids.commit}
                name="commit"
                className="mono"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                value={repository.commit}
                aria-describedby={describedBy}
                aria-invalid={errors.commit ? true : undefined}
                onChange={(event) =>
                  setRepository({ ...repository, commit: event.target.value })
                }
              />
            )}
          </Field>
          <div className="entry-actions">
            <span className="entry-actions-note">
              Nothing is fetched yet. The URL is only checked for shape.
            </span>
            <button className="primary" type="submit">
              Continue to brief
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {step === "brief" && (
        <form
          className="entry-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submitBrief();
          }}
        >
          <p className="entry-intro">
            Plain words, in the order a viewer needs them. Say what the user
            can do now that they could not do before.
          </p>
          <Field
            id={ids.name}
            label="Feature name"
            hint="Use the name people see in the product, for example: Filter completed tasks."
            error={errors.name}
            counter={<Counter value={brief.name.length} max={BRIEF_LIMITS.name} />}
          >
            {(describedBy) => (
              <input
                id={ids.name}
                name="name"
                value={brief.name}
                aria-describedby={describedBy}
                aria-invalid={errors.name ? true : undefined}
                onChange={(event) =>
                  setBrief({ ...brief, name: event.target.value })
                }
                autoFocus
              />
            )}
          </Field>
          <Field
            id={ids.changed}
            label="What changed"
            hint="One or two sentences. Describe the visible behaviour, not the intention."
            error={errors.changed}
            counter={
              <Counter value={brief.changed.length} max={BRIEF_LIMITS.changed} />
            }
          >
            {(describedBy) => (
              <textarea
                id={ids.changed}
                name="changed"
                rows={4}
                value={brief.changed}
                aria-describedby={
                  [describedBy, lintBrief(brief.changed).length ? ids.lint : ""]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                aria-invalid={errors.changed ? true : undefined}
                onChange={(event) =>
                  setBrief({ ...brief, changed: event.target.value })
                }
              />
            )}
          </Field>
          <LintList text={`${brief.name}\n${brief.changed}\n${brief.audience}`} id={ids.lint} />
          <Field
            id={ids.audience}
            label="Who it is for"
            hint="The role or team that benefits, for example: team leads who review weekly progress."
            error={errors.audience}
            counter={
              <Counter value={brief.audience.length} max={BRIEF_LIMITS.audience} />
            }
          >
            {(describedBy) => (
              <input
                id={ids.audience}
                name="audience"
                value={brief.audience}
                aria-describedby={describedBy}
                aria-invalid={errors.audience ? true : undefined}
                onChange={(event) =>
                  setBrief({ ...brief, audience: event.target.value })
                }
              />
            )}
          </Field>
          <div className="entry-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => go("repository")}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button className="primary" type="submit">
              Continue to footage
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {step === "footage" && (
        <form
          className="entry-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submitFootage();
          }}
        >
          <p className="entry-intro">
            A screen recording of the feature. The file stays on this device:
            the browser only reads its duration and size.
          </p>
          <div
            className={`entry-drop ${dragging ? "dragging" : ""} ${errors.hasFile ? "has-error" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {file ? (
              <div className="entry-file">
                <Film size={20} aria-hidden="true" />
                <div className="entry-file-body">
                  <strong>{file.name}</strong>
                  <dl className="entry-meta" aria-label="Footage metadata">
                    <div>
                      <dt>Size</dt>
                      <dd>{formatBytes(file.size)}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd data-testid="footage-duration">
                        {metaState === "loading"
                          ? "reading"
                          : metaState === "failed"
                            ? "not readable"
                            : formatDuration(meta.duration)}
                      </dd>
                    </div>
                    <div>
                      <dt>Frame</dt>
                      <dd data-testid="footage-frame">
                        {meta.width && meta.height
                          ? `${meta.width} x ${meta.height}`
                          : metaState === "failed"
                            ? "not readable"
                            : metaState === "loading"
                              ? "reading"
                              : "unknown"}
                      </dd>
                    </div>
                  </dl>
                  {metaState === "failed" && (
                    <p className="entry-hint">
                      This browser could not decode the file. You can still
                      continue; the pipeline checks it with ffprobe later.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={clearFile}
                  aria-label="Remove footage"
                >
                  <Trash2 size={15} />
                  Remove
                </button>
                {url && (
                  <video
                    className="entry-probe"
                    src={url}
                    preload="metadata"
                    muted
                    playsInline
                    tabIndex={-1}
                    aria-hidden="true"
                    onLoadedMetadata={(event) => {
                      const element = event.currentTarget;
                      setMeta({
                        duration: Number.isFinite(element.duration)
                          ? element.duration
                          : null,
                        width: element.videoWidth || null,
                        height: element.videoHeight || null,
                      });
                      setMetaState("ready");
                    }}
                    onError={() => setMetaState("failed")}
                  />
                )}
              </div>
            ) : (
              <>
                <Upload size={22} aria-hidden="true" />
                <p>
                  Drop an MP4, WebM or MOV file here, or
                </p>
                <label className="secondary entry-picker" htmlFor={ids.file}>
                  Choose a file
                </label>
                <input
                  id={ids.file}
                  ref={fileInput}
                  className="entry-file-input"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  aria-describedby={errors.hasFile ? `${ids.file}-error` : undefined}
                  aria-invalid={errors.hasFile ? true : undefined}
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
              </>
            )}
          </div>
          {errors.hasFile && (
            <p className="entry-error" id={`${ids.file}-error`} role="alert">
              <CircleAlert size={14} aria-hidden="true" />
              {errors.hasFile}
            </p>
          )}
          <Field
            id={ids.actor}
            label="Recorded by"
            hint="The person or team who recorded the footage, or who owns the account shown."
            error={errors.actor}
          >
            {(describedBy) => (
              <input
                id={ids.actor}
                name="actor"
                maxLength={80}
                value={actor}
                aria-describedby={describedBy}
                aria-invalid={errors.actor ? true : undefined}
                onChange={(event) => setActor(event.target.value)}
              />
            )}
          </Field>
          <div className={`entry-field entry-check ${errors.authorized ? "has-error" : ""}`}>
            <label htmlFor={ids.authorized}>
              <input
                id={ids.authorized}
                type="checkbox"
                checked={authorized}
                aria-describedby={errors.authorized ? `${ids.authorized}-error` : undefined}
                aria-invalid={errors.authorized ? true : undefined}
                onChange={(event) => setAuthorized(event.target.checked)}
              />
              <span>I am authorized to use this footage.</span>
            </label>
            {errors.authorized && (
              <p className="entry-error" id={`${ids.authorized}-error`} role="alert">
                <CircleAlert size={14} aria-hidden="true" />
                {errors.authorized}
              </p>
            )}
          </div>
          <div className="entry-actions">
            <button type="button" className="secondary" onClick={() => go("brief")}>
              <ArrowLeft size={16} />
              Back
            </button>
            <button className="primary" type="submit">
              Review inputs
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {step === "review" && file && (
        <div className="entry-form">
          <p className="entry-intro">Check the three inputs before creating the draft.</p>
          <dl className="entry-review">
            <div>
              <dt>
                <FileCode2 size={15} aria-hidden="true" />
                Repository
              </dt>
              <dd>
                <span className="mono">{repository.url}</span>
                <small>
                  {parsedRepo ? `${parsedRepo.owner} / ${parsedRepo.repo}` : ""}
                  {repository.commit
                    ? ` at ${repository.commit.slice(0, 12)}`
                    : " at default branch head"}
                </small>
                <button type="button" className="text-button" onClick={() => go("repository")}>
                  Edit repository
                </button>
              </dd>
            </div>
            <div>
              <dt>
                <Link2 size={15} aria-hidden="true" />
                Brief
              </dt>
              <dd>
                <strong>{brief.name}</strong>
                <span>{brief.changed}</span>
                <small>For: {brief.audience}</small>
                <button type="button" className="text-button" onClick={() => go("brief")}>
                  Edit brief
                </button>
              </dd>
            </div>
            <div>
              <dt>
                <Film size={15} aria-hidden="true" />
                Footage
              </dt>
              <dd>
                <span>{file.name}</span>
                <small>
                  {formatBytes(file.size)} / {formatDuration(meta.duration)} /{" "}
                  {meta.width && meta.height ? `${meta.width} x ${meta.height}` : "frame unknown"}
                </small>
                <small>
                  <ShieldCheck size={13} aria-hidden="true" /> Authorized, recorded by {actor}
                </small>
                <button type="button" className="text-button" onClick={() => go("footage")}>
                  Edit footage
                </button>
              </dd>
            </div>
          </dl>
          <p className="entry-status" role="status">
            Nothing has been sent yet. The pipeline runs locally when you start
            it.
          </p>
          <div className="entry-actions">
            <button type="button" className="secondary" onClick={() => go("footage")}>
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={disabled}
              onClick={finish}
              data-testid="entry-create"
            >
              <Check size={16} />
              Create project
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
