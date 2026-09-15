import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { MockUI } from '../components/MockUI';
import { ZoomContainer } from '../components/ZoomContainer';
import { Badge } from '../components/Badge';
import { COLORS, FONT, FONT_MONO } from '../lib/timing';
import { emphasizedDecelerate } from '../lib/easing';

export const Storyboard: React.FC = () => {
  const frame = useCurrentFrame();

  const cards = [
    { title: "The starting point", time: "6s", color: COLORS.Emerald },
    { title: "One clear action", time: "16s", color: COLORS.AccentIndigo },
    { title: "The visible result", time: "8s", color: COLORS.Amber }
  ];

  const evidencePanelX = interpolate(frame, [100, 130], [500, 0], {
    easing: emphasizedDecelerate,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.Canvas }}>
      <ZoomContainer focusX={400} focusY={450} zoomAmount={1.15} startFrame={50} duration={20}>
        <MockUI activeNav="Storyboard" breadcrumb="Storyboard / team-product">
          <div style={{ display: 'flex', height: '100%', fontFamily: FONT }}>
            <div style={{ width: '320px', padding: '24px', borderRight: `1px solid ${COLORS.Border}` }}>
              {cards.map((card, i) => {
                const cardStart = 15 + i * 8;
                const cardX = interpolate(frame, [cardStart, cardStart + 15], [-350, 0], {
                  easing: emphasizedDecelerate,
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                return (
                  <div key={i} style={{
                    backgroundColor: COLORS.Surface,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    translate: `${cardX}px 0px`,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '4px', backgroundColor: card.color, marginRight: '8px' }} />
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.Foreground }}>{card.title}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: COLORS.Muted }}>{card.time}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: 1, backgroundColor: COLORS.Inset, position: 'relative', overflow: 'hidden' }}>
              {frame >= 70 && (
                <div style={{ position: 'absolute', top: '100px', left: '100px' }}>
                  <Badge text="Traced to source code" x={0} y={0} startFrame={70} color={COLORS.Emerald} />
                </div>
              )}
              <div style={{
                position: 'absolute',
                right: '40px',
                top: '100px',
                width: '300px',
                backgroundColor: COLORS.Surface,
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                translate: `${evidencePanelX}px 0px`,
              }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: '13px', color: COLORS.Muted, marginBottom: '12px' }}>
                  README.md L42
                </div>
                <div style={{ fontStyle: 'italic', fontSize: '16px', color: COLORS.Foreground, marginBottom: '12px' }}>
                  "Every answer includes references"
                </div>
                <div style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: COLORS.Emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.Surface, fontSize: '14px' }}>
                  ✓
                </div>
              </div>
            </div>
          </div>
        </MockUI>
      </ZoomContainer>
    </AbsoluteFill>
  );
};
