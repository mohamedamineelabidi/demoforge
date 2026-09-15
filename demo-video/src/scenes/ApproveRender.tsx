import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { MockUI } from '../components/MockUI';
import { Cursor } from '../components/Cursor';
import { ProgressBar } from '../components/ProgressBar';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';
import { emphasizedDecelerate } from '../lib/easing';

export const ApproveRender: React.FC = () => {
  const frame = useCurrentFrame();

  const cursorX = interpolate(frame, [20, 35], [500, 960], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorY = interpolate(frame, [20, 35], [800, 600], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isApproved = frame >= 45;
  const showRender = frame >= 60;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.Canvas }}>
      <MockUI activeNav="Approvals" breadcrumb="Approvals / Storyboard review">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: FONT }}>
          {!showRender ? (
            <div style={{ width: '480px', backgroundColor: COLORS.Surface, borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0' }}>Storyboard approval</h2>
              <p style={{ fontSize: '16px', color: COLORS.Foreground, margin: '0 0 8px 0' }}>3 scenes, 30 seconds, 3 source-linked captions</p>
              <p style={{ fontFamily: FONT_MONO, fontSize: '13px', color: COLORS.Muted, margin: '0 0 32px 0' }}>48233975d9...</p>
              <div style={{ 
                height: '48px', 
                backgroundColor: COLORS.Emerald, 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: COLORS.Surface, 
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                {isApproved ? 'Approved ✓' : 'Approve'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {frame >= 155 ? (
                <div style={{ width: '640px', height: '360px', backgroundColor: COLORS.Obsidian, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: COLORS.Emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.Surface, fontSize: '24px' }}>▶</div>
                </div>
              ) : (
                <>
                  <ProgressBar startFrame={80} duration={60} width={500} color={COLORS.Emerald} />
                  <div style={{ marginTop: '24px', fontSize: '16px', color: COLORS.Foreground, height: '24px' }}>
                    {frame >= 140 ? 'Render complete ✓' : 
                     frame >= 120 ? 'Encoding video...' : 
                     frame >= 100 ? 'Compositing overlays...' : 
                     frame >= 80 ? 'Rendering scenes...' : ''}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </MockUI>
      {frame < 60 && <Cursor x={cursorX} y={cursorY} startFrame={20} clickFrame={35} />}
    </AbsoluteFill>
  );
};
