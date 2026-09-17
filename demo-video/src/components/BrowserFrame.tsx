import React from 'react';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';

interface BrowserFrameProps {
  children: React.ReactNode;
  url?: string;
  width?: number;
  height?: number;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  children,
  url = 'http://127.0.0.1:8000',
  width = 1600,
  height = 900,
}) => {
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '16px',
        backgroundColor: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Browser Window Header */}
      <div
        style={{
          height: '44px',
          backgroundColor: '#F3F4F6',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '14px',
          fontFamily: FONT,
          userSelect: 'none',
        }}
      >
        {/* macOS Traffic Lights */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#F59E0B',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
            }}
          />
        </div>

        {/* URL Address Bar */}
        <div
          style={{
            flex: 1,
            maxWidth: '480px',
            margin: '0 auto',
            height: '28px',
            backgroundColor: '#FFFFFF',
            borderRadius: '6px',
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontSize: '12px',
            fontFamily: FONT_MONO,
            color: COLORS.muted,
          }}
        >
          <span style={{ fontSize: '10px', opacity: 0.6 }}>🔒</span>
          <span>{url}</span>
        </div>

        {/* Right side badge */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: COLORS.accent,
            backgroundColor: '#6366F115',
            padding: '3px 8px',
            borderRadius: '4px',
          }}
        >
          LIVE
        </div>
      </div>

      {/* Screen Footage Body */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#000000',
        }}
      >
        {children}
      </div>
    </div>
  );
};

