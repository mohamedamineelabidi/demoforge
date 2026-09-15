// Google Material Design 3 easing presets for Remotion
// Reference: https://m3.material.io/styles/motion/easing-and-duration

import {Easing} from 'remotion';

/** Elements entering the screen — slow start, fast arrival */
export const emphasizedDecelerate = Easing.bezier(0.05, 0.7, 0.1, 1.0);

/** Elements leaving the screen — fast start, slow exit */
export const emphasizedAccelerate = Easing.bezier(0.3, 0.0, 0.8, 0.15);

/** Standard movement for camera, zoom, internal transitions */
export const standard = Easing.bezier(0.2, 0.0, 0.0, 1.0);

/** Standard decelerate for subtle arrivals */
export const standardDecelerate = Easing.bezier(0.0, 0.0, 0.0, 1.0);

/** Spring physics for UI element pop-in */
export const springPop = Easing.spring({damping: 200});

/** Smoothstep for cursor movement — matches walkthrough.mjs */
export const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

