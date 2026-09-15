import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { springPop } from '../lib/easing';
import { COLORS, FONT } from '../lib/timing';

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const wordmarkScale = interpolate(frame, [10, 30], [0.8, 1], {
    easing: springPop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lineWidth = interpolate(frame, [30, 45], [0, 200], {
    easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.Obsidian,
        opacity: bgOpacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <h1
        style={{
          fontFamily: FONT,
          fontSize: '72px',
          fontWeight: 'bold',
          color: COLORS.Surface,
          opacity: wordmarkOpacity,
          scale: `${wordmarkScale}`,
          margin: 0,
        }}
      >
        DemoForge
      </h1>
      
      <h2
        style={{
          fontFamily: FONT,
          fontSize: '28px',
          fontWeight: 400,
          color: COLORS.Muted,
          opacity: taglineOpacity,
          margin: '16px 0 0 0',
        }}
      >
        Ship features, not slide decks.
      </h2>

      <div
        style={{
          marginTop: '32px',
          height: '2px',
          width: `${lineWidth}px`,
          backgroundColor: COLORS.Emerald,
        }}
      />
    </AbsoluteFill>
  );
};
