/**
 * Google-style motion storyboard schema for the Remotion benchmark (TASK-082).
 *
 * Benchmark-only illustrative mock. Not product evidence. No runtime_observed
 * claim is made by these types. All animation is a pure function of frame
 * index. Zoom is capped at 1.5 per docs/MOTION_PRODUCTION.md pilot rule.
 */

export interface CameraKeyframe {
  frame: number;
  zoom: number;
  x: number;
  y: number;
}

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  isClicking?: boolean;
}

export interface BadgeCue {
  text: string;
  startFrame: number;
  durationFrames: number;
}

export interface VideoStoryboard {
  fps: number;
  durationInFrames: number;
  cameraTrack: CameraKeyframe[];
  cursorTrack: CursorKeyframe[];
  badgeCues: BadgeCue[];
}

export const MAX_PILOT_ZOOM = 1.5;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_PILOT_ZOOM, zoom));
}

export function validateStoryboard(board: VideoStoryboard): string[] {
  const issues: string[] = [];
  if (board.fps !== 30) {
    issues.push('pilot timebase must be 30 fps');
  }
  for (const key of board.cameraTrack) {
    if (key.zoom > MAX_PILOT_ZOOM) {
      issues.push(`camera zoom ${key.zoom} at frame ${key.frame} exceeds pilot cap 1.5`);
    }
    if (key.frame < 0 || key.frame > board.durationInFrames) {
      issues.push(`camera keyframe ${key.frame} out of range`);
    }
  }
  for (let i = 1; i < board.cameraTrack.length; i += 1) {
    if (board.cameraTrack[i].frame <= board.cameraTrack[i - 1].frame) {
      issues.push('camera track frames must be strictly increasing');
    }
  }
  for (let i = 1; i < board.cursorTrack.length; i += 1) {
    if (board.cursorTrack[i].frame <= board.cursorTrack[i - 1].frame) {
      issues.push('cursor track frames must be strictly increasing');
    }
  }
  for (const cue of board.badgeCues) {
    if (cue.startFrame < 0 || cue.startFrame + cue.durationFrames > board.durationInFrames) {
      issues.push(`badge cue "${cue.text}" out of range`);
    }
  }
  return issues;
}
