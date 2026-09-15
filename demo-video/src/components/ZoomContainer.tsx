import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { standard } from '../lib/easing';
import { WIDTH, HEIGHT } from '../lib/timing';

export const ZoomContainer: React.FC<{
  children: React.ReactNode;
  focusX: number;
  focusY: number;
  zoomAmount?: number;
  startFrame: number;
  duration: number;
}> = ({ children, focusX, focusY, zoomAmount = 1.15, startFrame, duration }) => {
  const frame = useCurrentFrame();

  const originX = WIDTH / 2;
  const originY = HEIGHT / 2;

  const maxTranslateX = (originX - focusX) * zoomAmount;
  const maxTranslateY = (originY - focusY) * zoomAmount;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        transformOrigin: `${originX}px ${originY}px`,
        scale: `${interpolate(
          frame,
          [startFrame, startFrame + duration],
          [1, zoomAmount],
          { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}`,
        translate: `${interpolate(
          frame,
          [startFrame, startFrame + duration],
          [0, maxTranslateX],
          { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}px ${interpolate(
          frame,
          [startFrame, startFrame + duration],
          [0, maxTranslateY],
          { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}px`,
      }}
    >
      {children}
    </div>
  );
};
