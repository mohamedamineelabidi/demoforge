import { MOTION_FPS } from "./motion";

export type MotionMedia = {
  url: string;
  name: string;
  permitted: boolean;
  reviewed: boolean;
  duration?: number;
};

export function localAssetUrl(url: string): string | null {
  if (url === "/taskroom.png") return url;
  if (!url.startsWith("blob:") || url.length <= 5 || /[\s\\%<>"'\u0000-\u001f\u007f]/.test(url))
    return null;
  return url;
}

export function sourceTime(sourceFrame: number, duration?: number): number | null {
  if (!Number.isSafeInteger(sourceFrame) || sourceFrame < 0 ||
      duration === undefined || !Number.isFinite(duration) || duration <= 0) return null;
  const seconds = sourceFrame / MOTION_FPS;
  return seconds < duration ? seconds : null;
}