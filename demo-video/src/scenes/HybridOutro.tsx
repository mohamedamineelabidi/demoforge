import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { springPop, emphasizedDecelerate } from '../lib/easing';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';

export const HybridOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const titleScale = interpolate(frame, [10, 36], [0, 1], {
    easing: springPop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardsOpacity = interpolate(frame, [35, 60], [0, 1], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaOpacity = interpolate(frame, [60, 85], [0, 1], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pills = [
    { label: 'Real UI Capture', icon: '🎥', color: '#6366F1' },
    { label: 'Frame-Accurate Edits', icon: '⏱️', color: '#F59E0B' },
    { label: 'SHA-256 Approval Chains', icon: '🔒', color: '#10B981' },
  ];

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
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, rgba(12, 13, 14, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Title */}
      <div
        style={{
          fontSize: '92px',
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '-2px',
          scale: titleScale,
          marginBottom: '16px',
        }}
      >
        DemoForge
      </div>

      <div
        style={{
          fontSize: '28px',
          color: '#9CA3AF',
          marginBottom: '40px',
          opacity: cardsOpacity,
        }}
      >
        Ship features, not slide decks.
      </div>

      {/* Value Pillars */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '50px',
          opacity: cardsOpacity,
        }}
      >
        {pills.map((pill) => (
          <div
            key={pill.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 22px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '30px',
              color: '#F3F4F6',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>{pill.icon}</span>
            <span>{pill.label}</span>
          </div>
        ))}
      </div>

      {/* CTA Pill */}
      <div
        style={{
          padding: '14px 28px',
          backgroundColor: '#6366F1',
          color: '#FFFFFF',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: FONT_MONO,
          letterSpacing: '0.5px',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)',
          opacity: ctaOpacity,
        }}
      >
        http://127.0.0.1:8000
      </div>
    </AbsoluteFill>
  );
};

