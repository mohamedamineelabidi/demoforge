import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Check, Download, Film, Play, RefreshCw, Sparkles } from "lucide-react";
import "./recorded.css";

interface RecordedJob {
  job_id: string;
  target_url: string;
  status: "pending" | "discovering" | "planning" | "recording" | "rendering" | "ready" | "failed";
  progress_pct: number;
  message: string;
  video_path?: string;
  sha256?: string;
  error?: string;
}

const STEPS = [
  { id: "discovering", label: "1. UI Discovery", desc: "Crawling interactive DOM landmarks" },
  { id: "planning", label: "2. Storyboard Director", desc: "Planning camera focus & callout badges" },
  { id: "recording", label: "3. Paced Feature Capture", desc: "Rehearsing & capturing real UI clips" },
  { id: "rendering", label: "4. Motion Synthesis", desc: "Synthesizing dynamic zooms & 1080p MP4" },
  { id: "ready", label: "5. Verified & Ready", desc: "Ready to preview, download, and share" },
];

export function RecordedDemoStudio({ onBack }: { onBack: () => void }) {
  const [targetUrl, setTargetUrl] = useState("http://127.0.0.1:8000");
  const [goal, setGoal] = useState("Showcase core workflow and release highlights");
  const [job, setJob] = useState<RecordedJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function startRecording(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/recorded-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: targetUrl, goal }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: Failed to start demo recording.`);
      }

      const initialJob: RecordedJob = await res.json();
      setJob(initialJob);

      // Start polling for progress
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = window.setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/recorded-demo/${initialJob.job_id}`);
          if (!pollRes.ok) return;
          const updatedJob: RecordedJob = await pollRes.json();
          setJob(updatedJob);

          if (updatedJob.status === "ready" || updatedJob.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setBusy(false);
            if (updatedJob.status === "failed") {
              setError(updatedJob.error || "Recording pipeline failed.");
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to initiate automated recording.");
      setBusy(false);
    }
  }

  function getStepStatus(stepIndex: number) {
    if (!job) return "";
    const statusMap: Record<string, number> = {
      pending: 0,
      discovering: 0,
      planning: 1,
      recording: 2,
      rendering: 3,
      ready: 5,
      failed: -1,
    };
    const currentIdx = statusMap[job.status] ?? 0;
    if (job.status === "ready" || currentIdx > stepIndex) return "done";
    if (currentIdx === stepIndex) return "active";
    return "";
  }

  function copyShareLink() {
    if (!job) return;
    const url = `${window.location.origin}/api/recorded-demo/${job.job_id}/video`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="recorded-studio">
      <div className="recorded-header">
        <button type="button" className="recorded-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Projects
        </button>
      </div>

      <div className="recorded-hero">
        <h1>Automated Recorded Demo</h1>
        <p>
          Enter any local or authorized web app address. DemoForge will automatically crawl the UI,
          direct the camera focus points, rehearse natural cursor gestures, and render a
          Google Workspace-style release demo with dynamic camera zooms, macOS framing, and animated callout badges.
        </p>

        <form className="recorded-form" onSubmit={startRecording}>
          <div className="recorded-input-group">
            <input
              type="text"
              className="recorded-input"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="e.g. http://127.0.0.1:8000 or http://localhost:3000"
              disabled={busy}
              required
            />
          </div>
          <button type="submit" className="recorded-btn-primary" disabled={busy}>
            {busy ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Recording in progress...
              </>
            ) : (
              <>
                <Film size={18} /> Record & Generate Demo Video
              </>
            )}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: "16px", padding: "12px 16px", background: "#FEE2E2", color: "#B91C1C", borderRadius: "8px" }}>
            {error}
          </div>
        )}
      </div>

      {job && (
        <div className="recorded-progress-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: "17px", color: "#1F2937" }}>
              Job ID: <span style={{ fontFamily: "monospace" }}>{job.job_id}</span>
            </div>
            <div style={{ fontWeight: 600, color: job.status === "ready" ? "#10B981" : "#6366F1" }}>
              {job.progress_pct}% — {job.message}
            </div>
          </div>

          <div className="recorded-progress-bar-wrap">
            <div className="recorded-progress-bar-fill" style={{ width: `${job.progress_pct}%` }} />
          </div>

          <div className="recorded-steps-grid">
            {STEPS.map((step, idx) => {
              const status = getStepStatus(idx);
              return (
                <div key={step.id} className={`recorded-step-item ${status}`}>
                  <div className="recorded-step-dot" />
                  <div style={{ fontWeight: 600 }}>{step.label}</div>
                  <div style={{ fontSize: "11px", opacity: 0.8 }}>{step.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {job && job.status === "ready" && (
        <div className="recorded-result-card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Sparkles color="#10B981" size={24} />
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
              Your Google-Style Release Demo is Ready!
            </h2>
          </div>

          <div className="recorded-video-wrap">
            <video
              src={`/api/recorded-demo/${job.job_id}/video`}
              controls
              autoPlay
              playsInline
            />
          </div>

          <div className="recorded-result-footer">
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <a
                href={`/api/recorded-demo/${job.job_id}/video`}
                download="demoforge-release-demo.mp4"
                className="recorded-btn-download"
              >
                <Download size={18} /> Download MP4 Video
              </a>

              <button type="button" className="recorded-btn-secondary" onClick={copyShareLink}>
                {copied ? <Check size={16} color="#10B981" /> : <Play size={16} />}
                {copied ? "Link Copied!" : "Copy Video Link"}
              </button>
            </div>

            {job.sha256 && (
              <div style={{ fontSize: "12px", color: "#6B7280", fontFamily: "monospace" }}>
                SHA-256: {job.sha256.substring(0, 16)}...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
