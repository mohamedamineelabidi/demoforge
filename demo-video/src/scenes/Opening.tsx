import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { springPop } from '../lib/easing';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';
import { TypewriterText } from '../components/TypewriterText';

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const wordmarkY = interpolate(frame, [10, 40], [60, 0], {
    easing: springPop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkOpacity = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lineWidth = interpolate(frame, [80, 100], [0, 120], {
    easing: Easing.bezier(0.2, 0.0, 0.0, 1.0),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const breathingScale = interpolate(
    Math.sin(frame / 10),
    [-1, 1],
    [1, 1.02],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const finalWordmarkScale = frame >= 100 ? breathingScale : 1;

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
          fontSize: '88px',
          fontWeight: 800,
          color: COLORS.Surface,
          letterSpacing: '-2px',
          opacity: wordmarkOpacity,
          translate: `0px ${wordmarkY}px`,
          scale: `${finalWordmarkScale}`,
          margin: 0,
        }}
      >
        DemoForge
      </h1>
      
      <div style={{ height: '40px', marginTop: '16px' }}>
        <TypewriterText 
          text="Source-linked demo videos"
          startFrame={35}
          charsPerFrame={2}
          style={{
            fontFamily: FONT,
            fontSize: '36px',
            fontWeight: 300,
            color: COLORS.Muted,
            margin: 0,
          }}
        />
      </div>

      <div
        style={{
          marginTop: '24px',
          height: '2px',
          width: `${lineWidth}px`,
          backgroundColor: COLORS.Emerald,
        }}
      />
    </AbsoluteFill>
  );
};
