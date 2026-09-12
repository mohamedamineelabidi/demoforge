import { useId, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CircleAlert, Film, RotateCcw, Save } from "lucide-react";
import { editScene, moveScene, type Project, type Scene } from "../model";
import {
  CAPTION_MAX_LENGTH,
  CLIP_REFERENCE_MAX_LENGTH,
  captionErrors,
  compareStoryboard,
  editCaption,
  setSceneEndFrame,
  timeline30fps,
} from "./model";
import "./frame-storyboard.css";

export type FrameStoryboardProps = {
  project: Project;
  onChange: (project: Project) => void;
  selectedSceneId: string;
  onSelectScene: (scene: Scene) => void;
  disabled?: boolean;
  reviewedScenes?: Scene[];
};

function CaptionEditor({ caption, disabled, onSave }: {
  caption: string;
  disabled: boolean;
  onSave: (caption: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(caption);
  const errors = captionErrors(value);
  const dirty = value !== caption;
  function save(event: FormEvent) {
    event.preventDefault();
    if (!disabled && dirty && errors.length === 0) onSave(value);
  }
  return (
    <form className="fs-caption" onSubmit={save} noValidate>
      <label htmlFor={`${id}-caption`}>Caption</label>
      <textarea
        id={`${id}-caption`}
        value={value}
        rows={3}
        disabled={disabled}
        aria-invalid={errors.length > 0}
        aria-describedby={`${id}-count${errors.length ? ` ${id}-errors` : ""}`}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="fs-caption-meta">
        <span id={`${id}-count`}>{value.length} / {CAPTION_MAX_LENGTH} characters</span>
        <span>{dirty ? "Unsaved caption" : "Saved in local draft"}</span>
      </div>
      <div id={`${id}-errors`} className="fs-errors" aria-live="polite">
        {errors.map((error, index) => <p key={`${index}-${error}`}>{error}</p>)}
      </div>
      <div className="fs-caption-actions">
        <button type="button" className="fs-icon" title="Discard caption edits"
          aria-label="Discard caption edits" disabled={disabled || !dirty}
          onClick={() => setValue(caption)}><RotateCcw size={16} aria-hidden="true" /></button>
        <button type="submit" className="fs-save" disabled={disabled || !dirty || errors.length > 0}>
          <Save size={16} aria-hidden="true" /> Save caption
        </button>
      </div>
    </form>
  );
}

function FrameInput({ label, initial, min, max, disabled, onSave }: {
  label: string;
  initial: number;
  min: number;
  max: number;
  disabled: boolean;
  onSave: (value: number) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(String(initial));
  const number = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(number) && number >= min && number <= max;
  function save() {
    if (!disabled && valid && number !== initial) onSave(number);
  }
  return (
    <div className="fs-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} step={1}
        value={value} disabled={disabled} aria-invalid={!valid}
        aria-describedby={!valid ? `${id}-error` : undefined}
        onChange={(event) => setValue(event.target.value)} onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); save(); }
          if (event.key === "Escape") setValue(String(initial));
        }} />
      {!valid && <p id={`${id}-error`} className="fs-errors" aria-live="polite">
        Enter a whole frame from {min} to {max}.
      </p>}
    </div>
  );
}

function ClipReference({ reference, disabled, onSave }: {
  reference: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(reference);
  function save() {
    if (!disabled && value !== reference && value.length <= CLIP_REFERENCE_MAX_LENGTH) onSave(value);
  }
  return <div className="fs-field">
    <label htmlFor={id}>Footage clip reference</label>
    <input id={id} value={value} maxLength={CLIP_REFERENCE_MAX_LENGTH} disabled={disabled}
      autoComplete="off" spellCheck={false} aria-describedby={`${id}-note`}
      onChange={(event) => setValue(event.target.value)} onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); save(); }
        if (event.key === "Escape") setValue(reference);
      }} />
    <p id={`${id}-note`} className="fs-note">Text reference only. Footage is not loaded or verified.</p>
  </div>;
}

export function FrameStoryboard({
  project, onChange, selectedSceneId, onSelectScene, disabled = false, reviewedScenes,
}: FrameStoryboardProps) {
  const id = useId();
  const sequence = timeline30fps(project.scenes);
  const comparison = compareStoryboard(project.scenes, reviewedScenes);
  const selected = sequence.scenes.find((scene) => scene.id === selectedSceneId);
  const extent = Math.max(sequence.targetFrames, sequence.totalFrames);
  function change(next: Project) {
    if (!disabled && next !== project) onChange(next);
  }
  return (
    <section className="frame-storyboard" aria-label="Frame storyboard editor">
      <div className="fs-summary">
        <strong>{sequence.totalFrames} / {sequence.targetFrames} frames</strong>
        <span>{sequence.fps} fps</span>
        <span>Local draft</span>
      </div>
      <div className="fs-status" aria-live="polite">
        {!sequence.matchesTarget && <p className="fs-warning">
          <CircleAlert size={16} aria-hidden="true" />
          {sequence.totalFrames < sequence.targetFrames
            ? `${sequence.targetFrames - sequence.totalFrames} frames below the MVP target.`
            : `${sequence.totalFrames - sequence.targetFrames} frames above the MVP target.`}
        </p>}
        {comparison.changed && <p className="fs-warning">
          <CircleAlert size={16} aria-hidden="true" />Storyboard changed, re-approval required
        </p>}
        <p className="fs-note">{comparison.hasBaseline
          ? "Compared with a local prior snapshot. No server approval is recorded here."
          : "No local review baseline. No server approval is recorded here."}</p>
        {disabled && <p className="fs-note">Storyboard editing is disabled.</p>}
      </div>
      <div className="fs-ruler" aria-hidden="true">
        <span>0 f</span><span>{Math.floor(extent / 2)} f</span><span>{extent} f</span>
      </div>
      <div className="fs-timeline" role="group" aria-label="Scene timeline in frames"
        style={{ gridTemplateColumns: sequence.scenes.map((scene) =>
          `minmax(0, ${scene.frames}fr)`).join(" ") +
          (extent > sequence.totalFrames ? ` minmax(0, ${extent - sequence.totalFrames}fr)` : "") }}>
        {sequence.scenes.map((scene, index) => <button type="button" key={scene.id}
          aria-pressed={scene.id === selectedSceneId}
          aria-label={`Scene ${index + 1}: ${scene.title}, frames [${scene.start_frame}, ${scene.end_frame})`}
          title={`${scene.title}: [${scene.start_frame}, ${scene.end_frame}) frames`}
          onClick={() => onSelectScene(project.scenes[index])}>
          <span>{String(index + 1).padStart(2, "0")}</span>
        </button>)}
      </div>
      <div className="fs-workspace">
        <ol className="fs-scenes" aria-label="Storyboard scenes">
          {sequence.scenes.map((scene, index) => {
            const changes = comparison.scenes[index];
            const changed = changes.captionChanged || changes.structureChanged;
            return <li key={scene.id} className={scene.id === selectedSceneId ? "fs-selected" : ""}>
              <button type="button" className="fs-scene-select"
                aria-pressed={scene.id === selectedSceneId}
                onClick={() => onSelectScene(project.scenes[index])}>
                <span className="fs-scene-title"><Film size={16} aria-hidden="true" />
                  <span>{String(index + 1).padStart(2, "0")} {scene.title}</span></span>
                <span className="fs-range">start_frame {scene.start_frame} / end_frame {scene.end_frame}</span>
                <span className="fs-range">[{scene.start_frame}, {scene.end_frame}) / {scene.frames} frames</span>
                <span className="fs-scene-caption">{scene.caption || "No caption"}</span>
                <span className="fs-range">Highlight: {scene.highlight} / Clip: {scene.footageClipRef || "Not linked"}</span>
              </button>
              <div className="fs-scene-footer">
                <span className={changed ? "fs-change" : "fs-note"}>
                  {changed ? "Changed since approval" : comparison.hasBaseline
                    ? "Matches local baseline" : "Not reviewed locally"}
                </span>
                <button type="button" className="fs-icon" title={`Move scene ${index + 1} up`}
                  aria-label={`Move scene ${index + 1} up`} disabled={disabled || index === 0}
                  onClick={() => change(moveScene(project, scene.id, -1))}>
                  <ArrowUp size={16} aria-hidden="true" /></button>
                <button type="button" className="fs-icon" title={`Move scene ${index + 1} down`}
                  aria-label={`Move scene ${index + 1} down`}
                  disabled={disabled || index === sequence.scenes.length - 1}
                  onClick={() => change(moveScene(project, scene.id, 1))}>
                  <ArrowDown size={16} aria-hidden="true" /></button>
              </div>
            </li>;
          })}
        </ol>
        {selected ? <div className="fs-properties" key={`${project.id}-${selected.id}`}
          role="group" aria-label={`Properties for ${selected.title}`}>
          <div className="fs-property-heading"><strong>{selected.title}</strong>
            <span className="fs-range">{selected.frames} frames</span></div>
          <CaptionEditor key={`caption-${selected.caption}`} caption={selected.caption} disabled={disabled}
            onSave={(caption) => change(editCaption(project, selected.id, caption))} />
          <div className="fs-timing">
            <div className="fs-field"><label htmlFor={`${id}-start`}>Start frame (inclusive)</label>
              <input id={`${id}-start`} value={selected.start_frame} readOnly /></div>
            <FrameInput key={`end-${selected.end_frame}-${selected.start_frame}`}
              label="End frame (exclusive)" initial={selected.end_frame}
              min={selected.start_frame + 1} max={selected.start_frame + 1800} disabled={disabled}
              onSave={(end) => change(setSceneEndFrame(project, selected.id, end))} />
            <FrameInput key={`trim-${selected.trimIn}`} label="Source in (frames)"
              initial={selected.trimIn} min={0} max={108000} disabled={disabled}
              onSave={(trimIn) => change(editScene(project, selected.id, { trimIn }))} />
          </div>
          <div className="fs-effects">
            <label htmlFor={`${id}-highlight`}>Highlight
              <select id={`${id}-highlight`} value={selected.highlight} disabled={disabled}
                onChange={(event) => change(editScene(project, selected.id, {
                  highlight: event.target.value as Scene["highlight"],
                }))}>
                <option value="none">None</option><option value="zoom">Zoom</option>
                <option value="caret">Caret annotation</option>
                <option value="box">Box</option><option value="spotlight">Spotlight</option>
              </select>
            </label>
            <label htmlFor={`${id}-zoom`}>Zoom <span>{selected.zoom.toFixed(2)}x</span>
              <input id={`${id}-zoom`} type="range" min={1} max={1.5} step={0.05}
                value={selected.zoom} disabled={disabled}
                onChange={(event) => change(editScene(project, selected.id, {
                  zoom: Number(event.target.value),
                }))} />
            </label>
          </div>
          <ClipReference key={`clip-${selected.footageClipRef}`} reference={selected.footageClipRef}
            disabled={disabled} onSave={(footageClipRef) =>
              change(editScene(project, selected.id, { footageClipRef }))} />
        </div> : <p className="fs-note">No scene selected.</p>}
      </div>
    </section>
  );
}