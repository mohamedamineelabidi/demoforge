import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { springPop } from '../lib/easing';
import { FONT } from '../lib/timing';

interface ActionCalloutProps {
  text: string;
  startFrame: number;
  color?: string;
  icon?: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export const ActionCallout: React.FC<ActionCalloutProps> = ({
  text,
  startFrame,
  color = '#10B981',
  icon = '✦',
  top,
  left,
  right,
  bottom,
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame) {
    return null;
  }

  const progress = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    easing: springPop,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [startFrame, startFrame + 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: top !== undefined ? `${top}px` : undefined,
        left: left !== undefined ? `${left}px` : undefined,
        right: right !== undefined ? `${right}px` : undefined,
        bottom: bottom !== undefined ? `${bottom}px` : undefined,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 18px',
        borderRadius: '30px',
        backgroundColor: color,
        color: '#FFFFFF',
        fontFamily: FONT,
        fontSize: '15px',
        fontWeight: 600,
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.12)',
        scale: progress,
        opacity,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '14px', opacity: 0.9 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

