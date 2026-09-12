import { useId } from "react";
import {
  CircleCheck,
  CircleDot,
  CirclePause,
  CirclePlus,
  CircleStop,
  CircleX,
  Clapperboard,
  FileSearch,
  Film,
  GitBranch,
  ListChecks,
  ScanEye,
  Unplug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LOCAL_RUN_OUTCOMES, LOCAL_RUN_STAGES } from "../mocks/run";
import type { RunState, RunStatus } from "../mocks/run";
import "./run-status.css";

const STATE_DISPLAY: Record<RunState, { label: string; icon: LucideIcon }> = {
  created: { label: "Created", icon: CirclePlus },
  ingesting: { label: "Ingesting", icon: FileSearch },
  planning: { label: "Planning", icon: ListChecks },
  awaiting_approval: { label: "Awaiting approval", icon: CirclePause },
  acquiring_footage: { label: "Acquiring footage", icon: Film },
  storyboarding: { label: "Storyboarding", icon: Clapperboard },
  rendering: { label: "Rendering", icon: CircleDot },
  reviewing: { label: "Reviewing", icon: ScanEye },
  complete: { label: "Complete", icon: CircleCheck },
  failed: { label: "Failed", icon: CircleX },
  cancelled: { label: "Cancelled", icon: CircleStop },
};

export type RunStatusPanelProps = Readonly<{ run: RunStatus }>;

export function RunStatusPanel({ run }: RunStatusPanelProps) {
  const headingId = useId();
  const sourceId = useId();
  const isTerminal = LOCAL_RUN_OUTCOMES.some((outcome) => outcome === run.current);

  return (
    <section className="run-status" aria-labelledby={headingId} aria-describedby={sourceId}>
      <header className="run-status-header">
        <div>
          <h2 id={headingId}>Run status</h2>
          <p className="run-status-source" id={sourceId}>
            <Unplug size={14} aria-hidden="true" />
            <span>Mock run / Backend not connected</span>
          </p>
        </div>
        <p className="run-status-current">
          {isTerminal ? "Mock outcome: " : "Current mock stage: "}
          <strong>{STATE_DISPLAY[run.current].label}</strong>
        </p>
      </header>

      <ol className="run-status-rail" aria-label="Mock run stages">
        {LOCAL_RUN_STAGES.map((stage) => {
          const current = run.current === stage;
          const completed = run.completedStages.includes(stage);
          const presentation = current ? "current" : completed ? "completed" : "unobserved";
          const tone = current ? stage === "awaiting_approval" ? "waiting" : "active" : presentation;
          const { label, icon: StageIcon } = STATE_DISPLAY[stage];
          const Icon = completed ? CircleCheck : StageIcon;
          const status = current
            ? stage === "awaiting_approval" ? "Paused in mock" : "Current mock stage"
            : completed ? "Completed in mock" : "Not observed";

          return (
            <li
              key={stage}
              className="run-status-step"
              data-run-state={stage}
              data-presentation={presentation}
              data-tone={tone}
              aria-current={current ? "step" : undefined}
            >
              <span className="run-status-icon"><Icon size={17} aria-hidden="true" /></span>
              <div className="run-status-step-copy">
                <span className="run-status-label">{label}</span>
                <span className="run-status-description">{status}</span>
              </div>
            </li>
          );
        })}
        <li className="run-status-terminal-group">
          <div className="run-status-terminal-heading">
            <GitBranch size={17} aria-hidden="true" />
            <span>Outcome alternatives</span>
          </div>
          <ul className="run-status-outcomes" aria-label="Alternative terminal outcomes">
            {LOCAL_RUN_OUTCOMES.map((outcome) => {
              const current = run.current === outcome;
              const { label, icon: Icon } = STATE_DISPLAY[outcome];
              return (
                <li
                  key={outcome}
                  className="run-status-outcome"
                  data-run-state={outcome}
                  data-presentation={current ? "current" : "alternative"}
                  data-tone={current ? outcome : "neutral"}
                  aria-current={current ? "step" : undefined}
                >
                  <Icon size={16} aria-hidden="true" />
                  <div className="run-status-step-copy">
                    <span className="run-status-label">{label}</span>
                    <span className="run-status-description">
                      {current ? "Mock outcome" : "Not selected"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      </ol>

      <footer className="run-status-attempts">
        <h3>{STATE_DISPLAY[run.attempts.stage].label} attempts</h3>
        <dl>
          <div>
            <dt>Transient attempts</dt>
            <dd>{run.attempts.transient} / 3</dd>
          </div>
          <div>
            <dt>Content repairs</dt>
            <dd>{run.attempts.repair} / 1</dd>
          </div>
        </dl>
      </footer>
    </section>
  );
}