import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { springPop, emphasizedDecelerate } from '../lib/easing';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';

interface HybridIntroProps {
  title?: string;
  tagline?: string;
}

export const HybridIntro: React.FC<HybridIntroProps> = ({
  title = 'DemoForge',
  tagline = 'Source-Linked Release Demos for Web Apps',
}) => {
  const frame = useCurrentFrame();

  const titleProgress = interpolate(frame, [8, 32], [0, 1], {
    easing: springPop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [25, 48], [0, 1], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lineWidth = interpolate(frame, [35, 60], [0, 140], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fontSize = title.length > 30 ? '64px' : title.length > 20 ? '80px' : '96px';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.obsidian,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(12, 13, 14, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Product Tag */}
      <div
        style={{
          fontSize: '13px',
          fontFamily: FONT_MONO,
          fontWeight: 600,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          padding: '6px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: '20px',
          opacity: subtitleOpacity,
        }}
      >
        PRODUCT FEATURE WALKTHROUGH
      </div>

      {/* Main Wordmark */}
      <div
        style={{
          fontSize,
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '-2px',
          scale: titleProgress,
          marginBottom: '16px',
          textAlign: 'center',
          maxWidth: '1600px',
          padding: '0 40px',
        }}
      >
        {title}
      </div>

      {/* Accent Line */}
      <div
        style={{
          width: `${lineWidth}px`,
          height: '3px',
          backgroundColor: '#6366F1',
          borderRadius: '2px',
          marginBottom: '24px',
        }}
      />

      {/* Tagline */}
      <div
        style={{
          fontSize: '30px',
          fontWeight: 400,
          color: '#9CA3AF',
          letterSpacing: '-0.5px',
          opacity: subtitleOpacity,
          textAlign: 'center',
          maxWidth: '1400px',
          padding: '0 40px',
        }}
      >
        {tagline}
      </div>
    </AbsoluteFill>
  );
};
