import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { standard } from '../lib/easing';
import { COLORS } from '../lib/timing';

export const Cursor: React.FC<{
  x: number;
  y: number;
  startFrame: number;
  clickFrame?: number;
  visible?: boolean;
}> = ({ x, y, startFrame, clickFrame, visible = true }) => {
  const frame = useCurrentFrame();

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 1000,
        left: 0,
        top: 0,
        translate: `${interpolate(
          frame,
          [startFrame, startFrame + 15],
          [960, x],
          { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}px ${interpolate(
          frame,
          [startFrame, startFrame + 15],
          [540, y],
          { easing: standard, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}px`,
      }}
    >
      {/* Click ripple */}
      {clickFrame && frame >= clickFrame && (
        <div
          style={{
            position: 'absolute',
            left: '-8px',
            top: '-8px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: COLORS.emerald,
            opacity: interpolate(
              frame,
              [clickFrame, clickFrame + 10],
              [0.5, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            ),
            scale: `${interpolate(
              frame,
              [clickFrame, clickFrame + 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )}`,
            transformOrigin: 'center',
          }}
        />
      )}
      
      {/* Pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.2))',
        }}
      >
        <path
          d="M5.5 3.5L18.5 11.5L11.5 13.5L9.5 20.5L5.5 3.5Z"
          fill="white"
          stroke="black"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
