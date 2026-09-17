import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { standard } from '../lib/easing';

interface DynamicCameraProps {
  children: React.ReactNode;
  focus: { x: number; y: number };
  zoomAmount?: number;
  durationInFrames: number;
  rampFrames?: number;
  baseWidth?: number;
  baseHeight?: number;
  /** Source footage size used for focus mapping. Defaults to 1280x720 capture. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export const DynamicCamera: React.FC<DynamicCameraProps> = ({
  children,
  focus,
  zoomAmount = 1.22,
  durationInFrames,
  rampFrames = 45,
  baseWidth = 1600,
  baseHeight = 856,
  sourceWidth = 1280,
  sourceHeight = 720,
}) => {
  const frame = useCurrentFrame();

  // Corporate grammar: slow push-in over 45 frames, then hold. No zoom-out
  // (zoom-out over real footage causes motion sickness + breaks readability).
  // Pure function of frame for preview/export parity.
  void durationInFrames;
  const currentScale = interpolate(frame, [0, rampFrames], [1, zoomAmount], {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Map focus from source pixels -> container percentages, clamped to safe area.
  // baseWidth/baseHeight describe the container; sourceWidth/sourceHeight the footage.
  void baseWidth;
  void baseHeight;
  const originX = Math.max(5, Math.min(95, (focus.x / sourceWidth) * 100));
  const originY = Math.max(5, Math.min(95, (focus.y / sourceHeight) * 100));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transformOrigin: `${originX}% ${originY}%`,
        scale: currentScale,
      }}
    >
      {children}
    </div>
  );
};

