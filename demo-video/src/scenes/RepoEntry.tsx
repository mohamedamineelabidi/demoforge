import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { MockUI } from '../components/MockUI';
import { Cursor } from '../components/Cursor';
import { TypewriterText } from '../components/TypewriterText';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';
import { emphasizedDecelerate } from '../lib/easing';

export const RepoEntry: React.FC = () => {
  const frame = useCurrentFrame();

  const cursorX = interpolate(frame, [25, 40, 80, 95], [500, 960, 960, 960], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const cursorY = interpolate(frame, [25, 40, 80, 95], [800, 420, 420, 510], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const buttonText = frame < 105 ? 'Prepare source teaser' : (frame < 180 ? 'Preparing...' : 'Prepared');
  const buttonColor = frame >= 105 ? COLORS.Muted : COLORS.Emerald;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.Canvas }}>
      <MockUI activeNav="Source teaser" breadcrumb="Source teaser / New" enterFrom={0}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <div
            style={{
              width: '520px',
              backgroundColor: COLORS.Surface,
              borderRadius: '16px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: FONT,
            }}
          >
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: COLORS.Foreground }}>
              Create source teaser
            </h2>
            <p style={{ margin: '8px 0 24px 0', fontSize: '14px', color: COLORS.Muted }}>
              Paste a public repository URL
            </p>
            <div
              style={{
                border: `1px solid ${COLORS.Border}`,
                borderRadius: '8px',
                height: '48px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <TypewriterText
                text="github.com/team/product"
                startFrame={40}
                charsPerFrame={1}
                style={{ fontFamily: FONT_MONO, fontSize: '16px', color: COLORS.Foreground }}
              />
            </div>
            <div
              style={{
                backgroundColor: buttonColor,
                color: COLORS.Surface,
                height: '48px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              {buttonText}
              {frame >= 115 && <span style={{ marginLeft: '8px' }}>✓</span>}
            </div>
          </div>
        </div>
      </MockUI>
      <Cursor x={cursorX} y={cursorY} startFrame={25} clickFrame={95} visible={true} />
    </AbsoluteFill>
  );
};
