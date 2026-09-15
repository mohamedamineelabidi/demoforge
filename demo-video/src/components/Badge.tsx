import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { springPop } from '../lib/easing';
import { COLORS, FONT } from '../lib/timing';

export const Badge: React.FC<{
  text: string;
  x: number;
  y: number;
  startFrame: number;
  color?: string;
}> = ({ text, x, y, startFrame, color = COLORS.emerald }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        backgroundColor: color,
        color: 'white',
        fontFamily: FONT,
        fontSize: '16px',
        fontWeight: 'bold',
        padding: '6px 14px',
        borderRadius: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        transformOrigin: 'center',
        scale: `${interpolate(
          frame - startFrame,
          [0, 10],
          [0, 1],
          { easing: springPop, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )}`,
      }}
    >
      {text}
    </div>
  );
};
