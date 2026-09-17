import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {emphasizedDecelerate} from '../lib/easing';

/**
 * Floating feature badge. Deterministic entry/exit, no springs.
 * Fixed to camera view so text stays sharp during punch-ins.
 */
export const CalloutBadge: React.FC<{
  text: string;
  startFrame: number;
  durationFrames: number;
}> = ({text, startFrame, durationFrames}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > startFrame + durationFrames) {
    return null;
  }

  const localFrame = frame - startFrame;
  const exitFrame = durationFrames - 10;

  const scale = interpolate(localFrame, [0, 12], [0.85, 1], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(
    localFrame,
    [0, 5, exitFrame, durationFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: '50%',
        transform: `translateX(-50%) scale(${scale})`,
        opacity,
        backgroundColor: '#1E1F20',
        color: '#FFFFFF',
        padding: '14px 28px',
        borderRadius: 40,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        fontSize: 20,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        zIndex: 50,
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{color: '#7CACF8'}}>{'\u2726'}</span>
      <span>{text}</span>
    </div>
  );
};
