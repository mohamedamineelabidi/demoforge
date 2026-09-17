import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {CameraKeyframe, clampZoom} from './types';
import {standard} from '../lib/easing';

/**
 * Deterministic camera viewport: scale + translate3d driven only by frame.
 * No CSS transitions, no wall-clock timers, no springs (springs can overshoot
 * per docs/MOTION_PRODUCTION.md). Zoom is clamped to the 1.5 pilot cap.
 */
export const CameraStage: React.FC<{
  cameraTrack: CameraKeyframe[];
  children: React.ReactNode;
}> = ({cameraTrack, children}) => {
  const frame = useCurrentFrame();

  const frames = cameraTrack.map((k) => k.frame);
  const zooms = cameraTrack.map((k) => clampZoom(k.zoom));
  const xs = cameraTrack.map((k) => k.x);
  const ys = cameraTrack.map((k) => k.y);

  const currentZoom = interpolate(frame, frames, zooms, {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentX = interpolate(frame, frames, xs, {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentY = interpolate(frame, frames, ys, {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        overflow: 'hidden',
        backgroundColor: '#F8F9FA',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: '50% 50%',
          transform: `scale(${currentZoom}) translate3d(${-currentX}px, ${-currentY}px, 0)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
