export const MOTION_FPS = 30;
export const MOTION_TARGET_FRAMES = 900;
export const MOTION_CAPTION_MAX = 60;
export const MOTION_MAX_SCALE = 1.12;

export type SceneRange = { start: number; end: number; zoom?: number; trimIn?: number };
export type MotionSample = {
  frame: number;
  totalFrames: number;
  sceneIndex: number;
  localFrame: number;
  sourceFrame: number;
  progress: number;
  opacity: number;
  reveal: number;
  translateY: number;
  scale: number;
};

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, lower: number, upper: number) =>
  Math.min(upper, Math.max(lower, finite(value, lower)));
const count = (value: number) => Math.floor(clamp(value, 0, Number.MAX_SAFE_INTEGER / 100));
export function motionEase(value: number) {
  const progress = clamp(value, 0, 1);
  if (progress === 0 || progress === 1) return progress;
  let lower = 0;
  let upper = 1;
  for (let iteration = 0; iteration < 40; iteration++) {
    const parameter = (lower + upper) / 2;
    const inverse = 1 - parameter;
    const position = 3 * inverse * inverse * parameter * 0.22 +
      3 * inverse * parameter * parameter * 0.36 + parameter ** 3;
    if (position < progress) lower = parameter;
    else upper = parameter;
  }
  return 1 - (1 - (lower + upper) / 2) ** 3;
}

export function captionAtFrame(caption: string, localFrame: number, reducedMotion = false) {
  return Array.from(caption).slice(0, reducedMotion ? MOTION_CAPTION_MAX :
    Math.min(MOTION_CAPTION_MAX, count(localFrame))).join("");
}

export function sceneRanges<T extends { frames: number }>(scenes: readonly T[]) {
  let end = 0;
  return scenes.map(scene => {
    const start = end;
    end += count(scene.frames);
    return { ...scene, start, end };
  });
}

export function motionAtFrame(ranges: readonly SceneRange[], requestedFrame: number): MotionSample {
  const valid = (range: SceneRange) => Number.isSafeInteger(range.start) &&
    Number.isSafeInteger(range.end) && range.start >= 0 && range.end > range.start;
  const totalFrames = ranges.reduce((end, range) => valid(range) ? Math.max(end, range.end) : end, 0);
  const frame = Math.floor(clamp(requestedFrame, 0, Math.max(0, totalFrames - 1)));
  const sceneIndex = ranges.findIndex(range => valid(range) && frame >= range.start && frame < range.end);
  const idle: MotionSample = { frame, totalFrames, sceneIndex, localFrame: 0, sourceFrame: 0,
    progress: 0, opacity: 0, reveal: 0, translateY: 0, scale: 1 };
  if (sceneIndex < 0) return idle;
  const range = ranges[sceneIndex];
  const duration = range.end - range.start;
  const localFrame = frame - range.start;
  const progress = clamp(localFrame / Math.max(1, duration - 1), 0, 1);
  const reveal = motionEase(localFrame / 14);
  const camera = motionEase(progress);
  return { frame, totalFrames, sceneIndex, localFrame,
    sourceFrame: count(range.trimIn ?? 0) + localFrame, progress, reveal,
    opacity: 1, translateY: 0,
    scale: 1 + (clamp(range.zoom ?? 1.08, 1, MOTION_MAX_SCALE) - 1) * camera };
}

export type PlaybackState = { frame: number; playing: boolean };
export type PlaybackAction = {
  type: "play" | "pause" | "restart" | "seek" | "tick";
  total: number;
  frame?: number;
};

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  const total = count(action.total);
  const last = Math.max(0, total - 1);
  const frame = Math.floor(clamp(state.frame, 0, last));
  switch (action.type) {
    case "restart": return { frame: 0, playing: false };
    case "pause": return { frame, playing: false };
    case "play": return { frame: frame >= last ? 0 : frame, playing: total > 0 };
    case "seek": return { frame: Math.floor(clamp(action.frame ?? 0, 0, last)), playing: false };
    case "tick": {
      if (!state.playing) return { frame, playing: false };
      const next = Math.floor(clamp(action.frame ?? frame, 0, last));
      return { frame: next, playing: total > 0 && next < last };
    }
  }
}