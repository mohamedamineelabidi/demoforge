import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { MockUI } from '../components/MockUI';
import { Cursor } from '../components/Cursor';
import { COLORS, FONT } from '../lib/timing';
import { emphasizedDecelerate } from '../lib/easing';

export const ReviewExport: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    "Duration: 30.0s at 30 fps",
    "Resolution: 1920 x 1080",
    "Captions: 3 source-linked",
    "Evidence: all claims traced",
    "Approval: storyboard approved",
    "Privacy: no sensitive data"
  ];

  const buttonPulse = interpolate(frame, [70, 77, 85], [1.0, 1.05, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const toastY = interpolate(frame, [95, 110], [100, 0], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorX = interpolate(frame, [70, 85], [500, 960], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const cursorY = interpolate(frame, [70, 85], [800, 700], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.Canvas }}>
      <MockUI activeNav="Review" breadcrumb="Review / Output quality">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: FONT }}>
          <div style={{ width: '600px', backgroundColor: COLORS.Surface, borderRadius: '16px', padding: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px 0' }}>Pre-export checklist</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
              {items.map((item, i) => {
                const start = 10 + i * 6;
                const x = interpolate(frame, [start, start + 15], [50, 0], { easing: emphasizedDecelerate, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const opacity = interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', translate: `${x}px 0px`, opacity }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: COLORS.Emerald, color: COLORS.Surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', marginRight: '16px' }}>✓</div>
                    <span style={{ fontSize: '16px', color: COLORS.Foreground }}>{item}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ 
              height: '48px', 
              backgroundColor: COLORS.Emerald, 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: COLORS.Surface, 
              fontWeight: 'bold',
              fontSize: '16px',
              scale: `${buttonPulse}`,
              transformOrigin: 'center center'
            }}>
              Download
            </div>
          </div>
        </div>
      </MockUI>
      
      {frame >= 95 && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          marginLeft: '-150px',
          width: '300px',
          backgroundColor: COLORS.Obsidian,
          color: COLORS.Surface,
          padding: '16px',
          borderRadius: '8px',
          fontFamily: FONT,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          translate: `0px ${toastY}px`,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
        }}>
          ↓ demo-video.mp4 exported
        </div>
      )}
      
      <Cursor x={cursorX} y={cursorY} startFrame={70} clickFrame={85} />
    </AbsoluteFill>
  );
};
