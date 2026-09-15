import React from 'react';
import { useCurrentFrame, interpolate, Easing, AbsoluteFill } from 'remotion';
import { emphasizedDecelerate } from '../lib/easing';
import { COLORS, FONT } from '../lib/timing';

export const MockUI: React.FC<{
  children: React.ReactNode;
  activeNav?: string;
  breadcrumb?: string;
  enterFrom?: number;
}> = ({ children, activeNav = 'Projects', breadcrumb = '', enterFrom = 0 }) => {
  const frame = useCurrentFrame();
  
  const navItems = [
    { name: 'Projects', icon: '📁' },
    { name: 'Source teaser', icon: '🎞️' },
    { name: 'Storyboard', icon: '🎨' },
    { name: 'Evidence', icon: '📋' },
    { name: 'Footage', icon: '📹' },
    { name: 'Review', icon: '✅' },
    { name: 'Approvals', icon: '🔒' },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.canvas, fontFamily: FONT, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '240px',
          backgroundColor: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          zIndex: 10,
          translate: `${interpolate(
            frame,
            [enterFrom, enterFrom + 30],
            [-240, 0],
            { easing: emphasizedDecelerate, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )}px 0`,
        }}
      >
        <div style={{ padding: '24px 20px', fontSize: '20px', fontWeight: 'bold', color: COLORS.foreground }}>
          DemoForge
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
          {navItems.map((item) => {
            const isActive = item.name === activeNav;
            return (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: isActive ? '#6366F112' : 'transparent',
                  color: isActive ? COLORS.accent : COLORS.muted,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '14px',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          left: '240px',
          top: 0,
          right: 0,
          height: '56px',
          backgroundColor: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          zIndex: 10,
          translate: `0 ${interpolate(
            frame,
            [enterFrom, enterFrom + 30],
            [-56, 0],
            { easing: emphasizedDecelerate, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          )}px`,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: '14px' }}>{breadcrumb}</div>
      </div>

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          left: '240px',
          top: '56px',
          right: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
