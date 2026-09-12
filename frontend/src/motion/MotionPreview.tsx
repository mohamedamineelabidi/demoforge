import { useEffect, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { Project } from "../model";
import type { Catalog } from "../evidence/imports";
import { localAssetUrl, sourceTime } from "./media";
import type { MotionMedia } from "./media";
import { captionAtFrame, motionAtFrame, MOTION_CAPTION_MAX, MOTION_FPS,
  MOTION_TARGET_FRAMES, playbackReducer, sceneRanges } from "./motion";
import "./motion.css";

export type MotionPreviewProps = {
  project: Project;
  catalog?: Catalog;
  media?: MotionMedia;
  demoImage?: string;
};

export function MotionPreview(props: MotionPreviewProps) {
  const sessionKey = JSON.stringify([props.project.id, props.project.revision,
    props.project.scenes, props.media, props.demoImage]);
  return <MotionSession key={sessionKey} {...props} />;
}

function MotionSession({ project, catalog, media, demoImage }: MotionPreviewProps) {
  const [playback, dispatch] = useReducer(playbackReducer, { frame: 0, playing: false });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [duration, setDuration] = useState<number>();
  const [readyFrame, setReadyFrame] = useState<number | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clockRef = useRef<{ frame: number; time: number } | null>(null);
  const ranges = sceneRanges(project.scenes);
  const sample = motionAtFrame(ranges, playback.frame);
  const scene = project.scenes[sample.sceneIndex];
  const total = sample.totalFrames;
  const videoUrl = media?.permitted && media.reviewed && media.url.startsWith("blob:")
    ? localAssetUrl(media.url) : null;
  const imageUrl = !videoUrl && project.demo && demoImage === "/taskroom.png"
    ? localAssetUrl(demoImage) : null;
  const boundedDuration = media?.duration === undefined ? duration :
    duration === undefined ? media.duration : Math.min(duration, media.duration);
  const targetTime = scene ? sourceTime(sample.sourceFrame, boundedDuration) : null;
  const videoReady = Boolean(videoUrl && targetTime !== null && !mediaFailed &&
    readyFrame === sample.sourceFrame);
  const canAdvance = Boolean(scene && (!videoUrl || videoReady));
  const claim = catalog?.claims.find(item => item.claim_id === scene?.claimId);
  const conceptual = !videoUrl && !imageUrl;
  const caption = scene?.caption ?? "";
  const captionTooLong = Array.from(caption).length > MOTION_CAPTION_MAX;
  const scale = reducedMotion ? 1 : sample.scale;
  const sourceStatus = mediaFailed ? "Footage could not be decoded" :
    targetTime === null ? (boundedDuration === undefined || !Number.isFinite(boundedDuration) ||
      boundedDuration <= 0 ? "Source duration unknown / Preview blocked" :
      "Source frame outside footage / Preview blocked") : "Waiting for source frame";

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) dispatch({ type: "pause", total });
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [total]);

  useEffect(() => {
    const video = videoRef.current;
    setReadyFrame(null);
    if (!video || targetTime === null || mediaFailed) return;
    let active = true;
    const ready = () => {
      if (active && !video.seeking && video.readyState >= 2 &&
          Math.abs(video.currentTime - targetTime) < 1 / (MOTION_FPS * 2))
        setReadyFrame(sample.sourceFrame);
    };
    video.addEventListener("seeked", ready);
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    video.pause();
    try {
      if (Math.abs(video.currentTime - targetTime) >= 1 / (MOTION_FPS * 2))
        video.currentTime = targetTime;
      ready();
    } catch { setMediaFailed(true); }
    return () => {
      active = false;
      video.removeEventListener("seeked", ready);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.pause();
    };
  }, [videoUrl, targetTime, sample.sourceFrame, duration, mediaFailed]);

  useEffect(() => {
    if (!playback.playing || !canAdvance) {
      clockRef.current = null;
      return;
    }
    if (videoUrl) clockRef.current = null;
    let request = 0;
    const tick = (timestamp: number) => {
      clockRef.current ??= { frame: sample.frame, time: timestamp };
      const elapsedFrames = Math.floor((timestamp - clockRef.current.time) * MOTION_FPS / 1000);
      const nextFrame = videoUrl ? sample.frame + Math.min(1, elapsedFrames) :
        clockRef.current.frame + elapsedFrames;
      if (nextFrame > sample.frame) {
        dispatch({ type: "tick", total, frame: nextFrame });
      } else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playback.playing, canAdvance, sample.frame, total, videoUrl]);

  useEffect(() => {
    if (videoUrl && (mediaFailed || targetTime === null)) dispatch({ type: "pause", total });
  }, [videoUrl, mediaFailed, targetTime, total]);

  return <section className="motion-preview" aria-label="Motion preview"
    style={{ "--motion-accent": project.accent } as CSSProperties}>
    <header className="motion-preview__header">
      <strong>{conceptual ? "Motion study" : "Source preview"}</strong>
      <span>Local draft</span><span>Not rendered</span>
    </header>
    <div className="motion-preview__kind">
      {conceptual ? "Conceptual source motion graphics" :
        videoUrl ? "Authorized / Privacy-reviewed local footage" : "Demo still / Not footage"}
    </div>
    {conceptual && <p className="motion-preview__notice">Not a product demonstration or generated video.</p>}
    {media && !videoUrl && <p className="motion-preview__notice">Footage unavailable: local authorization and privacy review required.</p>}
    <div className="motion-preview__composition" data-frame={sample.frame}
      data-scene={sample.sceneIndex}>
      <div className="motion-preview__visual">
        {videoUrl && <>
          <video ref={videoRef} src={videoUrl} muted playsInline preload="metadata"
            aria-label={media?.name ?? "Local footage"}
            style={{ visibility: videoReady ? "visible" : "hidden", transform: `scale(${scale})` }}
            onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
            onDurationChange={event => setDuration(event.currentTarget.duration)}
            onError={() => setMediaFailed(true)} />
          {!videoReady && <p className="motion-preview__blocked" role="status">{sourceStatus}</p>}
        </>}
        {imageUrl && !imageFailed && <img src={imageUrl} alt="Taskroom demo still, not footage"
          onError={() => setImageFailed(true)} style={{ transform: `scale(${scale})` }} />}
        {imageUrl && imageFailed && <p className="motion-preview__blocked" role="status">Demo still unavailable</p>}
        {conceptual && <div className="motion-preview__typography" style={{ transform: `scale(${scale})` }}>
          <strong>{project.name}</strong>
          <span>{scene?.title ?? "No scenes"}</span>
        </div>}
      </div>
      <div className="motion-preview__caption" aria-hidden="true">
        {captionAtFrame(caption, sample.localFrame, reducedMotion)}
      </div>
    </div>
    <div className="motion-preview__transport">
      <button type="button" aria-label={playback.playing ? "Pause motion preview" : "Play motion preview"}
        title={playback.playing ? "Pause motion preview" : "Play motion preview"}
        disabled={!playback.playing && !canAdvance}
        onClick={() => dispatch({ type: playback.playing ? "pause" : "play", total })}>
        {playback.playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button type="button" aria-label="Restart motion preview" title="Restart motion preview"
        onClick={() => dispatch({ type: "restart", total })}><RotateCcw size={18} /></button>
      <input type="range" min={0} max={Math.max(0, total - 1)} step={1} value={sample.frame}
        disabled={!total} aria-label="Preview frame" aria-valuetext={`Frame ${sample.frame} of ${total}`}
        onChange={event => dispatch({ type: "seek", frame: Number(event.target.value), total })} />
      <output>{sample.frame} / {Math.max(0, total - 1)} fr</output>
    </div>
    <div className="motion-preview__metadata">
      <span>{MOTION_FPS} fps</span><span>{total} frames / Target {MOTION_TARGET_FRAMES}</span>
      {reducedMotion && <span>Reduced motion</span>}
      {scene && <span>Source frame {sample.sourceFrame}</span>}
    </div>
    <div className="motion-preview__source">
      <span className="motion-preview__label">Scene title / editable label</span>
      <strong>{scene?.title ?? "No scenes"}</strong>
      <span className="motion-preview__label">Literal scene caption / Local draft</span>
      <p>{caption || "No caption"}</p>
      {captionTooLong && <p role="status">Caption exceeds 60 characters. Motion study shows the first 60; source text is unchanged.</p>}
      {claim ? <>
        <p>Claim {claim.claim_id} / Revision {claim.revision}</p>
        <p>Reported status: {claim.verification_status}</p>
        <p>Catalog {catalog?.catalog_id} / Revision {catalog?.revision}</p>
        <p>Evidence: {claim.evidence_ids.join(", ")}</p>
        {claim.limitations.map((limitation, index) => <p key={index}>{limitation}</p>)}
        <p>Reported claim support does not verify this caption or approve this preview.</p>
      </> : <p>No linked evidence{scene?.claimId ? ` / Unresolved claim ${scene.claimId}` : ""}</p>}
    </div>
  </section>;
}