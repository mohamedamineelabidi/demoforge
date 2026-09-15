import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { standard } from '../lib/easing';
import { COLORS } from '../lib/timing';

export const ProgressBar: React.FC<{
  startFrame: number;
  duration: number;
  width?: number;
  color?: string;
}> = ({ startFrame, duration, width = 400, color = COLORS.emerald }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: `${width}px`,
        height: '8px',
        backgroundColor: COLORS.inset,
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%',
          backgroundColor: color,
          width: `${interpolate(
            frame,
            [startFrame, startFrame + duration],
            [0, 100],
            { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )}%`,
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  );
};
