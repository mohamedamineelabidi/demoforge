import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Copy,
  Download,
  FileCode2,
  Film,
  FolderOpen,
  Layers,
  Link2,
  Menu,
  Monitor,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Redo2,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  Square,
  Terminal,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  createProject,
  editScene,
  moveScene,
  parseProjects,
  redo,
  recordApproval,
  STORAGE_KEY,
  timeline,
  undo,
  updateProject,
} from "./model";
import type { Project, Scene } from "./model";
import { EntryFlow, EntryLanding } from "./entry/EntryFlow";
import type { EntryResult } from "./entry/EntryFlow";
import { CatalogPanel, ReportPanel } from "./evidence/ArtifactPanels";
import type { ImportedArtifacts } from "./evidence/imports";
import { ApprovalReview } from "./approvals/ApprovalReview";
import { FrameStoryboard } from "./storyboard/FrameStoryboard";
import { CAPTION_MAX_LENGTH, captionErrors, compareStoryboard } from "./storyboard/model";
import { RepositoryEntry } from "./source-entry/RepositoryEntry";
import { MotionPreview } from "./motion/MotionPreview";
import { RunStatusPanel } from "./run/RunStatusPanel";
import { mockRunStatus } from "./mocks/run";
import { TeaserStudio } from "./teaser/TeaserStudio";
import { RecordedDemoStudio } from "./recorded/RecordedDemoStudio";
import "./workspace-review.css";
import "./entry/entry.css";

type View = "Projects" | "New" | "Source" | "Teaser" | "Recorded" | "Storyboard" | "Evidence" | "Footage" | "Review" | "Approvals";
type Media = {
  url: string;
  name: string;
  size: number;
  permitted: boolean;
  reviewed: boolean;
  duration?: number;
  width?: number;
  height?: number;
};
const navigation = [
  { name: "Storyboard", icon: Layers },
  { name: "Evidence", icon: Link2 },
  { name: "Footage", icon: Film },
  { name: "Review", icon: ShieldCheck },
  { name: "Approvals", icon: CheckCheck },
] as const;

function IconButton({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type="button"
      className={`icon-button ${props.className ?? ""}`}
      aria-label={label}
      data-tip={label}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function downloadDraft(project: Project) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { format: "demoforge-local-draft", version: 1, project },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `demoforge-draft-r${project.revision}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Fixture() {
  const [completed, setCompleted] = useState(false);
  return (
    <main className="fixture-page">
      <div className="fixture-brand">
        <CheckCheck size={28} />
        <strong>Taskroom</strong>
        <span>Demo data</span>
      </div>
      <div className="fixture-layout">
        <aside>
          <strong>Workspace</strong>
          <p>My tasks</p>
          <p>Team projects</p>
          <p>Archive</p>
          <div className="fixture-person">
            AM{" "}
            <span>
              Alex Morgan
              <br />
              <small>Demo workspace</small>
            </span>
          </div>
        </aside>
        <section>
          <div className="fixture-crumb">Workspace / My tasks</div>
          <h1>A little more clarity.</h1>
          <p>Your work, one task at a time.</p>
          <div className="fixture-toolbar">
            <button
              aria-pressed={!completed}
              onClick={() => setCompleted(false)}
            >
              All tasks
            </button>
            <button aria-pressed={completed} onClick={() => setCompleted(true)}>
              Completed
            </button>
          </div>
          {[
            { title: "Review the release notes", done: true, tag: "Content" },
            {
              title: "Record the product walkthrough",
              done: false,
              tag: "Product",
            },
            { title: "Update the onboarding copy", done: true, tag: "Design" },
            {
              title: "Prepare the launch checklist",
              done: false,
              tag: "Product",
            },
          ]
            .filter((task) => !completed || task.done)
            .map((task) => (
              <div className="fixture-task" key={task.title}>
                {task.done ? <Check size={18} /> : <Square size={18} />}
                <span>{task.title}</span>
                <small>{task.tag}</small>
              </div>
            ))}
          <div className="fixture-note">
            <CheckCheck size={20} />
            <span>Make room for what comes next.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

export function App() {
  if (window.location.hash === "#fixture") return <Fixture />;
  return <Workspace />;
}

function Workspace() {
  const [storageError, setStorageError] = useState("");
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? parseProjects(raw) : [];
    } catch {
      return [];
    }
  });
  const [view, setView] = useState<View>(window.location.hash.startsWith("#teaser") ? "Teaser" : "Projects");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [drawer, setDrawer] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [pane, setPane] = useState("scenes");
  const [editorMode, setEditorMode] = useState<"canvas" | "frames" | "motion">("canvas");
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<Record<string, Media>>({});
  const [imports, setImports] = useState<Record<string, ImportedArtifacts>>({});
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [creating, setCreating] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef(media);
  const project = projects.find((item) => item.id === activeId);
  const scene =
    project?.scenes.find((item) => item.id === sceneId) ?? project?.scenes[0];
  const clip = project ? media[project.id] : undefined;
  const previewAllowed = clip?.permitted && clip.reviewed;
  const sequence = project ? timeline(project.scenes) : [];
  const totalFrames = sequence.at(-1)?.end ?? 900;
  const currentScene = sequence.find((item) => item.id === scene?.id);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) parseProjects(raw);
    } catch {
      setStorageError(
        "Saved drafts could not be read. Existing browser data has not been overwritten.",
      );
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setConflict(true);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  useEffect(
    () => () =>
      Object.values(mediaRef.current).forEach((item) =>
        URL.revokeObjectURL(item.url),
      ),
    [],
  );
  useEffect(() => {
    setPlaying(false);
  }, [view, sceneId, activeId]);
  useEffect(() => {
    setMediaReady(false);
    const element = video.current;
    if (!element) return;
    const ready = () =>
      setMediaReady(element.readyState >= 2 && !element.error);
    const readinessEvents = ["loadeddata", "canplay", "seeked", "emptied", "error"];
    readinessEvents.forEach(event => element.addEventListener(event, ready));
    ready();
    return () => readinessEvents.forEach(event => element.removeEventListener(event, ready));
  }, [view, sceneId, activeId, clip?.url, previewAllowed]);
  useEffect(() => {
    if (creating) {
      dialog.current?.showModal();
      dialog.current
        ?.querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus();
    } else dialog.current?.close();
  }, [creating]);

  function persist(next: Project[]) {
    if (conflict || storageError) {
      setMessage("Resolve the browser storage warning before saving.");
      return false;
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, projects: next }),
      );
      setProjects(next);
      setMessage("Draft saved in this browser.");
      return true;
    } catch {
      setMessage(
        "Storage unavailable. This edit was not saved. Download the current draft before closing.",
      );
      return false;
    }
  }
  function change(next: Project) {
    persist(projects.map((item) => (item.id === next.id ? next : item)));
  }
  function patchScene(patch: Partial<Scene>) {
    if (!project || !scene) return;
    if (patch.caption !== undefined && captionErrors(patch.caption).length) {
      setMessage(captionErrors(patch.caption).join(" "));
      return;
    }
    try {
      change(editScene(project, scene.id, patch));
    } catch {
      setMessage(
        "Invalid scene value. Duration must be 1-1800 whole frames; trim must be nonnegative; zoom is 1-1.5.",
      );
    }
  }
  function selectScene(selected: Scene) {
    setSceneId(selected.id);
    setFrame(sequence.find((item) => item.id === selected.id)?.start ?? 0);
    video.current?.pause();
  }
  function openProject(selected: Project) {
    setActiveId(selected.id);
    setSceneId(selected.scenes[0].id);
    setFrame(0);
    setView("Storyboard");
    setMessage("");
  }
  function loadDemo() {
    const existing = projects.find((item) => item.demo);
    if (existing) {
      openProject(existing);
      return;
    }
    const demo = createProject("Taskroom / Filter completed tasks", true);
    if (persist([...projects, demo])) openProject(demo);
  }
  function navigate(next: View) {
    setView(next);
    setDrawer(false);
    setPlaying(false);
  }
  function startEntry() {
    setMessage("");
    setFirstRun(false);
    navigate("New");
  }
  function completeEntry(result: EntryResult) {
    const base = createProject(result.brief.name);
    const next = updateProject(base, {
      repository: result.repository.commit
        ? `${result.repository.url}@${result.repository.commit}`
        : result.repository.url,
      brief: `${result.brief.changed}\n\nFor: ${result.brief.audience}`,
    });
    const draft = { ...next, revision: 1, past: [] };
    if (!persist([...projects, draft])) return false;
    setMedia((previous) => ({
      ...previous,
      [draft.id]: {
        url: result.footage.url,
        name: result.footage.file.name,
        size: result.footage.file.size,
        permitted: true,
        reviewed: false,
        duration: result.footage.meta.duration ?? undefined,
        width: result.footage.meta.width ?? undefined,
        height: result.footage.meta.height ?? undefined,
      },
    }));
    openProject(draft);
    setMessage(
      "Draft created in this browser. Footage stays on this device until you review it.",
    );
    return true;
  }
  function attach(file?: File) {
    if (!file || !project) return;
    if (!file.type.startsWith("video/") || file.size > 500 * 1024 * 1024) {
      setMessage("Choose a supported video file smaller than 500 MB.");
      return;
    }
    if (clip) URL.revokeObjectURL(clip.url);
    setMedia({
      ...media,
      [project.id]: {
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        permitted: false,
        reviewed: false,
      },
    });
    setMessage(
      "Footage selected. Permission and privacy review are required before preview.",
    );
  }
  function seek(next: number) {
    setFrame(next);
    const target =
      sequence.find((item) => next >= item.start && next < item.end) ??
      sequence.at(-1);
    if (target) {
      setSceneId(target.id);
      if (video.current)
        video.current.currentTime = (target.trimIn + next - target.start) / 30;
    }
  }
  function removeMedia() {
    if (!project || !clip) return;
    URL.revokeObjectURL(clip.url);
    const next = { ...media };
    delete next[project.id];
    setMedia(next);
    setPlaying(false);
  }
  function removeProject() {
    if (
      !project ||
      !window.confirm(
        `Delete the local draft "${project.name}"? This cannot be undone.`,
      )
    )
      return;
    if (persist(projects.filter((item) => item.id !== project.id))) {
      removeMedia();
      setImports(previous => { const next = { ...previous }; delete next[project.id]; return next; });
      setActiveId(null);
      setView("Projects");
      setMessage("Local project deleted.");
    }
  }
  const storageBlocked = Boolean(conflict || storageError);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        className={`sidebar ${drawer ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <a
          className="wordmark"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate("Projects");
          }}
        >
          <span className="brand-icon">
            <Clapperboard size={23} />
          </span>
          DemoForge<span className="beta">LOCAL</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">P</span>
          <div>
            Personal workspace<small>Local drafts</small>
          </div>
          <MoreHorizontal size={17} />
        </div>
        <nav>
          <button
            className={view === "Projects" ? "nav-item selected" : "nav-item"}
            onClick={() => navigate("Projects")}
          >
            <FolderOpen size={19} />
            Projects<span>{projects.length}</span>
          </button>
          <p className="nav-label">PRODUCTION</p>
          <button className={`nav-item ${view === "Teaser" ? "selected" : ""}`}
            onClick={() => { window.history.replaceState(null, "", "#teaser"); navigate("Teaser"); }}>
            <Clapperboard size={19} />Source teaser
          </button>
          <button className={`nav-item ${view === "Recorded" ? "selected" : ""}`}
            onClick={() => { window.history.replaceState(null, "", "#recorded"); navigate("Recorded"); }}>
            <Film size={19} />Recorded demo
          </button>
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${view === item.name ? "selected" : ""}`}
              disabled={!project}
              onClick={() => navigate(item.name)}
              aria-current={view === item.name ? "page" : undefined}
            >
              <item.icon size={19} />
              {item.name}
              {item.name === "Storyboard" && project && (
                <span>{project.scenes.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <span className="connection-dot" />
            <div>
              Local workspace<small>Drafts and source teasers</small>
            </div>
          </div>
          <div className="profile">
            <span className="profile-avatar">LW</span>
            <div>
              Local workspace<small>No account connected</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <IconButton
              label="Open navigation"
              className="mobile-menu"
              onClick={() => setDrawer(true)}
            >
              <Menu size={20} />
            </IconButton>
            <button onClick={() => navigate("Projects")}>Projects</button>
            {project && view !== "Projects" && (
              <>
                <ChevronRight size={14} />
                <span>{project.name}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="local-marker">
              <span />
              Local workspace
            </span>
            <span className="profile-avatar small">LW</span>
          </div>
        </header>
        {storageBlocked && (
          <div className="global-warning" role="alert">
            <CircleAlert size={18} />
            <span>
              {storageError ||
                "Drafts changed in another tab. Reload before making more edits."}
            </span>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}
        <main id="workspace">
          {view === "Recorded" ? <RecordedDemoStudio onBack={() => { window.history.replaceState(null, "", window.location.pathname); navigate("Projects"); }} /> : view === "Teaser" ? <TeaserStudio onBack={() => { window.history.replaceState(null, "", window.location.pathname); navigate("Projects"); }} /> : view === "Source" ? <RepositoryEntry disabled={storageBlocked} onCancel={() => navigate("Projects")}
            onCreate={input => {
              const base = createProject(input.name);
              const draft = { ...base, repository: input.repository, brief: input.brief };
              if (!persist([...projects, draft])) return false;
              openProject(draft);
              setEditorMode("motion");
              setMessage("Source draft created. Repository ingestion and generation have not run.");
              return true;
            }} /> : view === "New" ? (
            <EntryFlow
              disabled={storageBlocked}
              onCancel={() => navigate("Projects")}
              onComplete={completeEntry}
            />
          ) : view === "Projects" && projects.length === 0 && !firstRun ? (
            <section className="projects-page">
              <button className="primary" onClick={() => navigate("Teaser")}><Clapperboard size={16} />Create source teaser</button>
              <EntryLanding disabled={storageBlocked} onStart={startEntry} />
              <div className="entry-landing-secondary">
                <button className="secondary" disabled={storageBlocked} onClick={() => navigate("Source")}><Link2 size={16} />Start from repository</button>
                <button className="secondary" disabled={storageBlocked} onClick={loadDemo} aria-label="Open demo data">
                  <FolderOpen size={16} />
                  Open demo data
                </button>
                <span className="muted">See a finished storyboard built from fixture data, not a customer recording.</span>
              </div>
              <div className="workspace-footer">
                <ShieldCheck size={16} />
                Drafts stay in this browser.
                <button className="text-button" onClick={() => setFirstRun(true)}>
                  Open the project library
                </button>
              </div>
            </section>
          ) : view === "Projects" ? (
            <section className="projects-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">PERSONAL WORKSPACE</p>
                  <h1>Your next release, in the making.</h1>
                  <p className="subheading">Projects</p>
                </div>
                <button
                  className="primary"
                  disabled={storageBlocked}
                  onClick={startEntry}
                >
                  <Plus size={17} />
                  New project
                </button>
              </div>
              <div className="studio-start">
                <button className="new-draft-tile" disabled={storageBlocked} onClick={startEntry}>
                  <span className="creation-symbol"><Plus size={26} strokeWidth={1.5} /></span>
                  <span><strong>New release demo</strong><small>Repository, brief and footage / 16:9 / 30 fps</small></span>
                  <ArrowRight size={18} />
                </button>
                <button className="demo-feature" disabled={storageBlocked} onClick={loadDemo} aria-label="Open demo data">
                  <img src="/taskroom.png" alt="Taskroom demo fixture task list" />
                  <span className="demo-feature-content"><Badge>Demo data</Badge><strong>One action.<br />A clearer story.</strong><span className="demo-feature-action">Open sample project <ArrowRight size={16} /></span></span>
                </button>
              </div>
              <button className="primary" onClick={() => navigate("Teaser")}><Clapperboard size={16} />Create source teaser</button>
              <div className="library-heading"><h2>Project library <span>{projects.length.toString().padStart(2, "0")}</span></h2><button className="secondary" disabled={storageBlocked} onClick={() => navigate("Source")}><Link2 size={16} />Start from repository</button></div>
              <div className="project-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search projects"
                    placeholder="Find a project..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Project filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All projects</option>
                  <option value="real">Your drafts</option>
                  <option value="demo">Demo data</option>
                </select>
              </div>
              <div className="project-list library-grid">
                {projects
                  .filter(
                    (item) =>
                      item.name.toLowerCase().includes(search.toLowerCase()) &&
                      (filter === "all" ||
                        (filter === "demo" ? item.demo : !item.demo)),
                  )
                  .map((item) => (
                    <article className="draft-tile" key={item.id}>
                      <button
                        className="draft-open"
                        onClick={() => openProject(item)}
                      >
                        <span className={`draft-art ${item.demo ? "is-demo" : ""}`}>
                          {item.demo ? <img src="/taskroom.png" alt="" /> : <span className="draft-frame"><Film size={32} strokeWidth={1.25} /><span>No footage</span></span>}
                          <span className="draft-format">16:9</span>
                        </span>
                        <span className="draft-title">
                          <strong>{item.name}</strong>
                          <small>
                            {item.demo ? "Demo data" : "Local draft"} /{" "}
                            {item.scenes.length} scenes
                          </small>
                        </span>
                      </button>
                      <div className="draft-meta"><Badge>Draft r{item.revision}</Badge><span>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span><ArrowRight size={15} /></div>
                    </article>
                  ))}
                {projects.length === 0 && (
                  <div className="empty-projects">
                    <FolderOpen size={24} strokeWidth={1.4} />
                    <div><h2>A fresh workspace.</h2><p>No projects yet.</p></div>
                    <button
                      className="primary"
                      disabled={storageBlocked}
                      onClick={startEntry}
                    >
                      <Plus size={17} />
                      Create a project
                    </button>
                  </div>
                )}
                {projects.length > 0 &&
                  !projects.some(
                    (item) =>
                      item.name.toLowerCase().includes(search.toLowerCase()) &&
                      (filter === "all" ||
                        (filter === "demo" ? item.demo : !item.demo)),
                  ) && (
                    <div className="empty-projects">
                      <Search size={30} />
                      <h2>No matching projects</h2>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
              </div>
              <div className="workspace-footer">
                <ShieldCheck size={16} />
                Drafts stay in this browser.
                <span>DemoForge / Local preview</span>
              </div>
            </section>
          ) : (
            project &&
            scene && (
              <>
                <div className="project-heading">
                  <div>
                    <div className="heading-meta">
                      <span className="eyebrow">RELEASE DEMO</span>
                      {project.demo && <Badge tone="amber">Demo data</Badge>}
                    </div>
                    <h1>{project.name}</h1>
                    <div className="project-meta">
                      <Badge>Draft r{project.revision}</Badge>
                      <span>16:9</span>
                      <span>30 fps</span>
                      <span>{totalFrames} frames</span>
                    </div>
                  </div>
                  <div className="heading-actions">
                    <button
                      className="secondary"
                      onClick={() => downloadDraft(project)}
                    >
                      <Download size={16} />
                      Draft JSON
                    </button>
                    <button
                      className="primary"
                      onClick={() =>
                        navigate(view === "Review" ? "Storyboard" : "Review")
                      }
                    >
                      {view === "Review" ? (
                        <Layers size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                      {view === "Review" ? "Back to editor" : "Review draft"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="view-tabs" aria-label="Project views">
                  {navigation.map((item) => (
                    <button
                      key={item.name}
                      aria-current={view === item.name ? "page" : undefined}
                      className={view === item.name ? "active" : ""}
                      onClick={() => navigate(item.name)}
                    >
                      <item.icon size={16} />
                      {item.name}
                    </button>
                  ))}
                  <span className="saved-indicator">
                    <Check size={14} />
                    Browser draft
                  </span>
                </div>
                <details className="workspace-run-panel">
                  <summary><Terminal size={16} />Run status<span>Mock / not connected</span><ChevronRight size={16} /></summary>
                  <RunStatusPanel run={mockRunStatus} />
                </details>
                {view === "Storyboard" && (
                  <>
                    <div className="editor-toolbar">
                      <div>
                        <Clapperboard size={17} />
                        <strong>Storyboard</strong>
                        <span className="muted">
                          {project.scenes.length} scenes
                        </span>
                      </div>
                      <div>
                        <div className="editor-modes" role="group" aria-label="Storyboard editor mode">
                          <button aria-pressed={editorMode === "canvas"} onClick={() => setEditorMode("canvas")}><Monitor size={15} />Canvas</button>
                          <button aria-pressed={editorMode === "frames"} onClick={() => setEditorMode("frames")}><Layers size={15} />Frames</button>
                          <button aria-pressed={editorMode === "motion"} onClick={() => setEditorMode("motion")}><Play size={15} />Motion</button>
                        </div>
                        <IconButton
                          label="Undo scene edit"
                          disabled={!project.past.length || storageBlocked}
                          onClick={() => change(undo(project))}
                        >
                          <Undo2 size={17} />
                        </IconButton>
                        <IconButton
                          label="Redo scene edit"
                          disabled={!project.future.length || storageBlocked}
                          onClick={() => change(redo(project))}
                        >
                          <Redo2 size={17} />
                        </IconButton>
                        <span className="toolbar-divider" />
                        <span className="mono small-text">
                          {totalFrames} frames
                        </span>
                      </div>
                    </div>
                    {project.storyboardReview && (editorMode === "canvas" || !compareStoryboard(project.scenes, project.storyboardReview.scenes).changed) && (project.storyboardReview.revision !== project.revision ||
                      compareStoryboard(project.scenes, project.storyboardReview.scenes).changed) &&
                      <div className="storyboard-reapproval" role="status"><CircleAlert size={17} /><span>Storyboard changed, re-approval required</span><button onClick={() => navigate("Approvals")}>Review changes<ArrowRight size={15} /></button></div>}
                    {editorMode === "motion" ? <MotionPreview project={project} catalog={imports[project.id]?.catalog}
                      onMetadata={(url, metadata) => setMedia(current => {
                        const attached = current[project.id];
                        if (!attached || attached.url !== url || !attached.permitted || !attached.reviewed ||
                            (attached.duration === metadata.duration && attached.width === metadata.width &&
                              attached.height === metadata.height)) return current;
                        return { ...current, [project.id]: { ...attached, ...metadata } };
                      })}
                      media={clip} demoImage={project.demo ? "/taskroom.png" : undefined} /> : editorMode === "frames" ? <FrameStoryboard project={project} onChange={change}
                      selectedSceneId={scene.id} onSelectScene={selectScene} disabled={storageBlocked}
                      reviewedScenes={project.storyboardReview?.scenes} /> : <>
                    <div className="pane-selector">
                      <button
                        className={pane === "scenes" ? "active" : ""}
                        onClick={() => setPane("scenes")}
                      >
                        Scenes
                      </button>
                      <button
                        className={pane === "properties" ? "active" : ""}
                        onClick={() => setPane("properties")}
                      >
                        Properties
                      </button>
                    </div>
                    <div className={`editor-grid show-${pane}`}>
                      <aside className="scene-panel" aria-label="Scenes">
                        <div className="panel-heading">
                          SCENES
                          <span>
                            {project.scenes.length.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <div className="scene-list">
                          {sequence.map((item, index) => (
                            <div
                              className={`scene-item ${scene.id === item.id ? "selected" : ""}`}
                              key={item.id}
                            >
                              <button
                                className="scene-select"
                                onClick={() => selectScene(item)}
                                aria-pressed={scene.id === item.id}
                              >
                                <div className="scene-thumbnail">
                                  {project.demo ? (
                                    <img
                                      src="/taskroom.png"
                                      alt="Taskroom demo fixture"
                                    />
                                  ) : (
                                    <Film size={26} strokeWidth={1.2} />
                                  )}
                                  <span>
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <small>
                                    {item.frames} f
                                  </small>
                                </div>
                                <strong>{item.title}</strong>
                                <small>
                                  {item.start} - {item.end} f
                                </small>
                              </button>
                              <div className="scene-bottom">
                                <span>
                                  <span
                                    className={`tiny-dot ${item.claimId ? "green" : ""}`}
                                  />
                                  {item.claimId
                                    ? "Demo claim"
                                    : "No claim linked"}
                                </span>
                                <IconButton
                                  label={`Move scene ${index + 1} up`}
                                  disabled={index === 0 || storageBlocked}
                                  onClick={() =>
                                    change(moveScene(project, item.id, -1))
                                  }
                                >
                                  <ArrowUp size={13} />
                                </IconButton>
                                <IconButton
                                  label={`Move scene ${index + 1} down`}
                                  disabled={
                                    index === project.scenes.length - 1 ||
                                    storageBlocked
                                  }
                                  onClick={() =>
                                    change(moveScene(project, item.id, 1))
                                  }
                                >
                                  <ArrowDown size={13} />
                                </IconButton>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="scene-footnote">
                          Starting state / Action / Result
                        </p>
                      </aside>
                      <section
                        className="preview-panel"
                        aria-label="Scene preview"
                      >
                        <div className="preview-heading">
                          <span>
                            <Monitor size={16} />
                            Preview
                          </span>
                          <Badge>
                            {clip
                              ? "Local footage"
                              : project.demo
                                ? "Demo still"
                                : "No footage"}
                          </Badge>
                        </div>
                        <div className="preview-mat">
                          <div
                            className="scene-preview"
                            style={
                              {
                                "--customer-accent": project.accent,
                              } as CSSProperties
                            }
                          >
                            {clip && previewAllowed ? (
                              <video
                                ref={video}
                                key={`${clip.url}-${scene.id}`}
                                src={clip.url}
                                playsInline
                                preload="metadata"
                                style={{ transform: `scale(${scene.zoom})` }}
                                onLoadedMetadata={(event) => {
                                  const element = event.currentTarget;
                                  setMedia((previous) => ({
                                    ...previous,
                                    [project.id]: {
                                      ...previous[project.id],
                                      duration: element.duration,
                                      width: element.videoWidth,
                                      height: element.videoHeight,
                                    },
                                  }));
                                  element.currentTime = scene.trimIn / 30;
                                }}
                                onTimeUpdate={(event) => {
                                  const element = event.currentTarget;
                                  const position =
                                    Math.round(element.currentTime * 30) -
                                    scene.trimIn;
                                  if (position >= scene.frames) {
                                    element.pause();
                                    setPlaying(false);
                                  }
                                  setFrame(
                                    Math.min(
                                      totalFrames - 1,
                                      (currentScene?.start ?? 0) +
                                        Math.max(0, position),
                                    ),
                                  );
                                }}
                                onEnded={() => setPlaying(false)}
                                onPause={() => setPlaying(false)}
                                onError={() =>
                                  setMessage(
                                    "This video cannot be decoded by the browser. Try a compatible MP4 or WebM.",
                                  )
                                }
                              />
                            ) : clip ? (
                              <div className="preview-empty">
                                <ShieldCheck size={34} />
                                <strong>Preview restricted</strong>
                                <button onClick={() => navigate("Footage")}>
                                  Review permissions
                                </button>
                              </div>
                            ) : project.demo ? (
                              <img
                                className="demo-preview"
                                src="/taskroom.png"
                                alt="Demo data: Taskroom task-list fixture, not a customer recording"
                                style={{ transform: `scale(${scene.zoom})` }}
                              />
                            ) : (
                              <div className="preview-empty">
                                <Film size={34} />
                                <strong>No footage selected</strong>
                                <button onClick={() => navigate("Footage")}>
                                  Select footage
                                  <ArrowRight size={15} />
                                </button>
                              </div>
                            )}
                            {(!clip || previewAllowed) && scene.caption && (
                              <div className="preview-caption">
                                <span>{scene.caption}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="transport">
                          <div>
                            <IconButton
                              label="Return to scene start"
                              onClick={() => seek(currentScene?.start ?? 0)}
                            >
                              <SkipBack size={17} />
                            </IconButton>
                            <IconButton
                              label={playing ? "Pause footage" : "Play footage"}
                              disabled={!previewAllowed || !mediaReady}
                              onClick={() => {
                                if (!video.current) return;
                                if (playing) video.current.pause();
                                else {
                                  if (
                                    video.current.currentTime >=
                                    (scene.trimIn + scene.frames) / 30
                                  )
                                    video.current.currentTime =
                                      scene.trimIn / 30;
                                  void video.current
                                    .play()
                                    .then(() => setPlaying(true))
                                    .catch(() =>
                                      setMessage(
                                        "Playback failed. Check the selected video format.",
                                      ),
                                    );
                                }
                              }}
                            >
                              <>
                                {playing ? (
                                  <Pause size={18} />
                                ) : (
                                  <Play size={18} />
                                )}
                              </>
                            </IconButton>
                            <span className="mono">
                              {frame} f{" "}
                              <span className="muted">
                                / {totalFrames} f
                              </span>
                            </span>
                          </div>
                          <span className="preview-resolution">
                            1920 x 1080
                          </span>
                        </div>
                        <label className="scrubber">
                          <span className="sr-only">Storyboard position</span>
                          <input
                            type="range"
                            min={0}
                            max={totalFrames - 1}
                            value={Math.min(frame, totalFrames - 1)}
                            onChange={(event) =>
                              seek(Number(event.target.value))
                            }
                          />
                        </label>
                        <div className="timeline-ruler">
                          <span>0 f</span>
                          <span>
                            {Math.round(totalFrames / 2)} f
                          </span>
                          <span>{totalFrames} f</span>
                        </div>
                        <div className="timeline-tracks">
                          {sequence.map((item, index) => (
                            <button
                              key={item.id}
                              onClick={() => selectScene(item)}
                              style={{ flex: item.frames }}
                              className={item.id === scene.id ? "active" : ""}
                              title={item.title}
                            >
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <strong>{item.title}</strong>
                            </button>
                          ))}
                        </div>
                        <div className="preview-notice">
                          <CircleAlert size={14} />
                          <span>
                            {clip
                              ? "Local playback. Render parity has not been verified."
                              : project.demo
                                ? "Demo still only. No product footage has been rendered."
                                : "Playback requires permitted, privacy-reviewed footage."}
                          </span>
                        </div>
                      </section>
                      <aside
                        className="inspector"
                        aria-label="Scene properties"
                      >
                        <div className="panel-heading">
                          SCENE PROPERTIES
                          <Settings2 size={15} />
                        </div>
                        <div className="inspector-section">
                          <Badge>
                            Scene {project.scenes.indexOf(scene) + 1}
                          </Badge>
                          <label>
                            Scene name
                            <input
                              key={`${scene.id}-title-${project.revision}`}
                              defaultValue={scene.title}
                              maxLength={80}
                              disabled={storageBlocked}
                              onBlur={(event) => {
                                if (event.target.value !== scene.title)
                                  patchScene({ title: event.target.value });
                              }}
                            />
                          </label>
                          <label>
                            Caption
                            <textarea
                              key={`${scene.id}-caption-${project.revision}`}
                              defaultValue={scene.caption}
                              maxLength={CAPTION_MAX_LENGTH}
                              rows={3}
                              disabled={storageBlocked}
                              onBlur={(event) => {
                                if (event.target.value !== scene.caption)
                                  patchScene({ caption: event.target.value });
                              }}
                            />
                          </label>
                          <div className="field-note">
                            {scene.caption.length}/{CAPTION_MAX_LENGTH}
                            <span>
                              {scene.claimId
                                ? "Demo claim attached"
                                : "No evidence attached"}
                            </span>
                          </div>
                        </div>
                        <div className="inspector-section">
                          <h2>Timing</h2>
                          <div className="input-pair">
                            <label>
                              Duration (frames)
                              <input
                                aria-label="Duration in frames"
                                type="number"
                                min={1}
                                max={1800}
                                step={1}
                                key={`${scene.id}-duration-${project.revision}`}
                                defaultValue={scene.frames}
                                disabled={storageBlocked}
                                onBlur={(event) => {
                                  if (
                                    Number(event.target.value) !== scene.frames
                                  )
                                    patchScene({
                                      frames: Number(event.target.value),
                                    });
                                }}
                              />
                            </label>
                            <label>
                              Source in (frames)
                              <input
                                aria-label="Source in frames"
                                type="number"
                                min={0}
                                max={108000}
                                step={1}
                                key={`${scene.id}-trim-${project.revision}`}
                                defaultValue={scene.trimIn}
                                disabled={storageBlocked}
                                onBlur={(event) => {
                                  if (
                                    Number(event.target.value) !== scene.trimIn
                                  )
                                    patchScene({
                                      trimIn: Number(event.target.value),
                                    });
                                }}
                              />
                            </label>
                          </div>
                          <div className="timing-summary">
                            <span>Scene duration</span>
                            <strong>{(scene.frames / 30).toFixed(2)} s</strong>
                          </div>
                          <label className="zoom-label">
                            Preview zoom <span>{scene.zoom.toFixed(2)}x</span>
                            <input
                              type="range"
                              min="1"
                              max="1.5"
                              step="0.05"
                              value={scene.zoom}
                              disabled={storageBlocked}
                              onChange={(event) =>
                                patchScene({ zoom: Number(event.target.value) })
                              }
                            />
                          </label>
                        </div>
                        <div className="inspector-section">
                          <h2>Customer accent</h2>
                          <div className="swatches">
                            {(
                              [
                                { color: "#176B5B", name: "Forest" },
                                { color: "#315DA8", name: "Blue" },
                                { color: "#A23F58", name: "Rose" },
                              ] as const
                            ).map((swatch) => (
                              <button
                                className="swatch"
                                key={swatch.color}
                                style={{ background: swatch.color }}
                                aria-label={swatch.name}
                                aria-pressed={project.accent === swatch.color}
                                disabled={storageBlocked}
                                onClick={() =>
                                  change(
                                    updateProject(project, {
                                      accent: swatch.color,
                                    }),
                                  )
                                }
                              >
                                {project.accent === swatch.color && (
                                  <Check size={16} />
                                )}
                              </button>
                            ))}
                            <span className="mono">{project.accent}</span>
                          </div>
                        </div>
                        <div className="inspector-section">
                          <h2>Evidence</h2>
                          {imports[project.id]?.catalog && <label>Claim reference
                            <select aria-label="Scene claim reference" value={scene.claimId} disabled={storageBlocked}
                              onChange={event => patchScene({ claimId: event.target.value })}>
                              <option value="">No claim linked</option>
                              {scene.claimId && !imports[project.id]?.catalog?.claims.some(claim => claim.claim_id === scene.claimId) &&
                                <option value={scene.claimId}>Unresolved: {scene.claimId}</option>}
                              {imports[project.id]?.catalog?.claims.map(claim => <option key={claim.claim_id} value={claim.claim_id}>{claim.claim_id}</option>)}
                            </select>
                          </label>}
                          <button
                            className="evidence-link"
                            onClick={() => navigate("Evidence")}
                          >
                            <Link2 size={15} />
                            <span>{scene.claimId || "No linked claim"}</span>
                            <ChevronRight size={15} />
                          </button>
                          <span className="inspector-note">
                            {scene.claimId
                              ? "Demo fixture / Not approved"
                              : "Approval requires backend evidence."}
                          </span>
                        </div>
                      </aside>
                    </div>
                    </>}
                  </>
                )}
                {view === "Approvals" && <ApprovalReview project={project} catalog={imports[project.id]?.catalog}
                  drafts={project.approvalDrafts} disabled={storageBlocked} onDecision={approval => {
                    const next = recordApproval(project, approval);
                    if (!persist(projects.map(item => item.id === project.id ? next : item))) {
                      throw new Error("Local decision could not be saved.");
                    }
                    setMessage("Not sent, local draft");
                  }} />}
                {view === "Evidence" && (
                  <section className="detail-page">
                    <div className="section-heading">
                      <div>
                        <h2>Evidence & claims</h2>
                        <p className="muted">
                          Source support and human approval are separate.
                        </p>
                      </div>
                      <Badge tone="amber">
                        {imports[project.id]?.catalog ? "Imported / unverified" : "No imported catalog"}
                      </Badge>
                    </div>
                    <CatalogPanel key={project.id} catalog={imports[project.id]?.catalog} repository={project.repository}
                      onImport={value => setImports(previous => ({ ...previous, [project.id]: { ...previous[project.id], ...value } }))}
                      onRemove={() => setImports(previous => ({ ...previous, [project.id]: { ...previous[project.id], catalog: undefined } }))} />
                    {project.demo && !imports[project.id]?.catalog && <div className="evidence-layout">
                      <div>
                        <div className="panel-heading">
                          CLAIMS<span>{project.demo ? "01" : "00"}</span>
                        </div>
                        {project.demo ? (
                          <div className="claim-entry">
                            <span className="mono">DEMO-CLM-001</span>
                            <h3>Filter completed tasks.</h3>
                            <Badge>Demo only</Badge>
                            <p>Human approval: not requested</p>
                          </div>
                        ) : (
                          <div className="inline-empty">
                            <Link2 size={26} />
                            <h3>No evidence catalog</h3>
                            <p>
                              A repository reference is not verified evidence.
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="source-detail">
                        <h3>Source context</h3>
                        {project.demo ? (
                          <>
                            <div className="source-file">
                              <FileCode2 size={18} />
                              frontend/src/App.tsx / Fixture
                            </div>
                            <pre>
                              {
                                "tasks.filter(task =>\n  !completed || task.done\n)"
                              }
                            </pre>
                            <p className="muted">
                              Local demonstration fixture. Not a revision-pinned
                              evidence record or a runtime observation.
                            </p>
                            <a
                              href="/#fixture"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open fixture
                              <ArrowRight size={15} />
                            </a>
                          </>
                        ) : (
                          <p className="muted">
                            No revision-pinned sources available.
                          </p>
                        )}
                        <dl>
                          <dt>Evidence verification</dt>
                          <dd>Not run</dd>
                          <dt>Claim approval</dt>
                          <dd>Not approved</dd>
                          <dt>Runtime observation</dt>
                          <dd>Not recorded</dd>
                        </dl>
                      </div>
                    </div>}
                    <div className="brief-form">
                      <label>
                        Repository reference
                        <input
                          defaultValue={project.repository}
                          key={`${project.id}-repo`}
                          placeholder="https://github.com/owner/repository"
                          maxLength={500}
                          disabled={storageBlocked}
                          onBlur={(event) => {
                            if (event.target.value !== project.repository)
                              change(
                                updateProject(project, {
                                  repository: event.target.value,
                                }),
                              );
                          }}
                        />
                      </label>
                      <label>
                        Feature brief
                        <textarea
                          defaultValue={project.brief}
                          key={`${project.id}-brief`}
                          placeholder="What should this release demo show?"
                          maxLength={2000}
                          rows={4}
                          disabled={storageBlocked}
                          onBlur={(event) => {
                            if (event.target.value !== project.brief)
                              change(
                                updateProject(project, {
                                  brief: event.target.value,
                                }),
                              );
                          }}
                        />
                      </label>
                    </div>
                  </section>
                )}
                {view === "Footage" && (
                  <section className="detail-page">
                    <div className="section-heading">
                      <div>
                        <h2>Supplied footage</h2>
                        <p className="muted">
                          Session-local files / 500 MB maximum
                        </p>
                      </div>
                      <Badge>Not uploaded</Badge>
                    </div>
                    <label className="upload-zone">
                      <Upload size={28} />
                      <strong>
                        {clip ? "Replace footage" : "Select product footage"}
                      </strong>
                      <span>MP4, WebM or another browser-supported video</span>
                      <input
                        aria-label="Select product footage"
                        type="file"
                        accept="video/*"
                        onChange={(event) => {
                          attach(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {clip ? (
                      <div className="media-details">
                        <div className="media-file">
                          <Film size={24} />
                          <div>
                            <strong>{clip.name}</strong>
                            <small>
                              {(clip.size / 1024 / 1024).toFixed(2)} MB /
                              Session only
                            </small>
                          </div>
                          <IconButton
                            label="Remove footage"
                            onClick={removeMedia}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </div>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={clip.permitted}
                            onChange={(event) =>
                              setMedia({
                                ...media,
                                [project.id]: {
                                  ...clip,
                                  permitted: event.target.checked,
                                },
                              })
                            }
                          />
                          <span>I have permission to use this footage.</span>
                        </label>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={clip.reviewed}
                            onChange={(event) =>
                              setMedia({
                                ...media,
                                [project.id]: {
                                  ...clip,
                                  reviewed: event.target.checked,
                                },
                              })
                            }
                          />
                          <span>
                            I reviewed the full recording for private or
                            sensitive content.
                          </span>
                        </label>
                        <p className="permission-note">
                          Local attestations only. Server-side permission,
                          privacy and decode gates have not run.
                        </p>
                        <dl>
                          <dt>Browser dimensions</dt>
                          <dd>
                            {clip.width
                              ? `${clip.width} x ${clip.height}`
                              : "Not measured"}
                          </dd>
                          <dt>Browser duration</dt>
                          <dd>
                            {clip.duration
                              ? `${clip.duration.toFixed(2)} seconds`
                              : "Not measured"}
                          </dd>
                          <dt>Frame count / SHA-256</dt>
                          <dd>Not measured</dd>
                        </dl>
                        <button
                          className="secondary"
                          disabled={!previewAllowed}
                          onClick={() => navigate("Storyboard")}
                        >
                          <Play size={16} />
                          Open preview
                        </button>
                      </div>
                    ) : (
                      <div className="inline-empty">
                        <p>
                          No footage attached. Files are not retained after
                          reload.
                        </p>
                      </div>
                    )}
                  </section>
                )}
                {view === "Review" && (
                  <section className="detail-page">
                    <div className="section-heading">
                      <div>
                        <h2>Review before export</h2>
                        <p className="muted">
                          Draft revision {project.revision} / No rendered
                          artifact
                        </p>
                      </div>
                      <Badge tone="amber">Export blocked</Badge>
                    </div>
                    <div className="review-summary">
                      <ShieldCheck size={28} />
                      <div>
                        <h3>This draft is not approved for export.</h3>
                        <p>
                          Backend validation, a rendered artifact and
                          exact-revision approval are required.
                        </p>
                      </div>
                    </div>
                    <ReportPanel key={project.id} report={imports[project.id]?.report} catalog={imports[project.id]?.catalog}
                      onImport={value => setImports(previous => ({ ...previous, [project.id]: { ...previous[project.id], ...value } }))}
                      onRemove={() => setImports(previous => ({ ...previous, [project.id]: { ...previous[project.id], report: undefined } }))} />
                    <div className="checks">
                      {[
                        {
                          name: "Pilot duration",
                          detail: `${totalFrames} / 900 frames at 30 fps`,
                          pass: totalFrames === 900,
                        },
                        {
                          name: "Scene captions",
                          detail: "Every scene has nonempty copy",
                          pass: project.scenes.every((item) =>
                            item.caption.trim(),
                          ),
                        },
                        {
                          name: "Source trim bounds",
                          detail: clip?.duration
                            ? "Compared with browser-reported duration only"
                            : "Footage duration has not been measured",
                          pass: clip?.duration
                            ? project.scenes.every(
                                (item) =>
                                  item.trimIn + item.frames <=
                                  clip.duration! * 30,
                              )
                            : false,
                        },
                      ].map((check) => (
                        <div className="check-row" key={check.name}>
                          <span
                            className={
                              check.pass
                                ? "check-icon green"
                                : "check-icon amber"
                            }
                          >
                            {check.pass ? (
                              <Check size={17} />
                            ) : (
                              <CircleAlert size={17} />
                            )}
                          </span>
                          <div>
                            <strong>{check.name}</strong>
                            <small>{check.detail}</small>
                          </div>
                          <Badge tone={check.pass ? "green" : "amber"}>
                            {check.pass
                              ? "Local check passed"
                              : "Needs attention"}
                          </Badge>
                        </div>
                      ))}
                      {[
                        "Revision-pinned evidence",
                        "Claim & storyboard approval",
                        "Render and full decode",
                        "Full-video privacy review",
                        "Artifact-hash approval",
                      ].map((check) => (
                        <div className="check-row" key={check}>
                          <span className="check-icon">
                            <CircleAlert size={17} />
                          </span>
                          <div>
                            <strong>{check}</strong>
                            <small>Backend not connected</small>
                          </div>
                          <Badge>Not run</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="review-actions">
                      <button
                        className="secondary"
                        onClick={() => downloadDraft(project)}
                      >
                        <Download size={16} />
                        Download draft JSON
                      </button>
                      <button className="primary" disabled>
                        <Download size={16} />
                        Export video
                      </button>
                    </div>
                  </section>
                )}
                <section className="execution-region">
                  <button
                    className="execution-toggle"
                    aria-expanded={logsOpen}
                    onClick={() => setLogsOpen(!logsOpen)}
                  >
                    <Terminal size={16} />
                    <strong>Execution log</strong>
                    <Badge>No job</Badge>
                    <span>{logsOpen ? "Collapse" : "Expand"}</span>
                  </button>
                  {logsOpen && (
                    <div className="log-viewer">
                      <div>
                        <span>LOCAL SESSION</span>
                        <IconButton
                          label="Copy execution status"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(
                                "Backend not connected. No render job submitted.",
                              )
                              .then(() =>
                                setMessage("Execution status copied."),
                              )
                              .catch(() =>
                                setMessage("Clipboard unavailable."),
                              );
                          }}
                        >
                          <Copy size={15} />
                        </IconButton>
                      </div>
                      <p>
                        <span>status</span>Backend not connected.
                      </p>
                      <p>
                        <span>render</span>No render job submitted.
                      </p>
                      <p>
                        <span>draft</span>Local revision {project.revision}. Not
                        an approved artifact.
                      </p>
                    </div>
                  )}
                </section>
              </>
            )
          )}
          {project && view !== "Projects" && (
            <div className="draft-footer">
              <IconButton
                label="Delete local project"
                disabled={storageBlocked}
                onClick={removeProject}
              >
                <Trash2 size={16} />
              </IconButton>
              <span>Local draft only</span>
              {clip &&
                !mediaReady &&
                view === "Storyboard" &&
                previewAllowed && <span>Loading footage...</span>}
            </div>
          )}
          <div className="status-message" role="status">
            {message}
          </div>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setCreating(false)}
        onClose={() => setCreating(false)}
        aria-labelledby="new-project-title"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = String(data.get("name")).trim();
            if (!name) return;
            const next = createProject(name);
            if (persist([...projects, next])) {
              setCreating(false);
              openProject(next);
            }
          }}
        >
          <div className="dialog-heading">
            <h2 id="new-project-title">New project</h2>
            <IconButton
              label="Close new project"
              onClick={() => setCreating(false)}
            >
              <X size={19} />
            </IconButton>
          </div>
          <label>
            Project name
            <input
              name="name"
              placeholder="September release"
              required
              maxLength={80}
              autoFocus
            />
          </label>
          <p className="muted">Local draft / 16:9 / 30 fps</p>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button className="primary" type="submit">
              <Plus size={16} />
              Create project
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
