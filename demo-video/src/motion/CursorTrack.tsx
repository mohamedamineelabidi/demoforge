import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {CursorKeyframe} from './types';
import {standard, emphasizedDecelerate} from '../lib/easing';

/**
 * Fast decoupled cursor: 12-frame (400 ms) moves match the measured
 * owned-app fast profile (402-420 ms, 21 events, max gap 48 ms).
 * Rendered natively at 30 fps so retiming does not require re-recording.
 * Click pulse uses deterministic bezier, not spring, to avoid overshoot.
 * Illustrative benchmark layer only, never a runtime_observed claim.
 */
export const CursorTrack: React.FC<{track: CursorKeyframe[]}> = ({track}) => {
  const frame = useCurrentFrame();

  const frames = track.map((t) => t.frame);
  const xs = track.map((t) => t.x);
  const ys = track.map((t) => t.y);

  const currentX = interpolate(frame, frames, xs, {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentY = interpolate(frame, frames, ys, {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const activeClick = track.find(
    (t) => t.isClicking && Math.abs(frame - t.frame) < 16,
  );

  let clickScale = 1;
  let rippleScale = 0;
  let rippleOpacity = 0;

  if (activeClick) {
    const progress = frame - activeClick.frame;
    clickScale = interpolate(progress, [0, 4, 10], [1, 0.82, 1], {
      easing: emphasizedDecelerate,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    rippleScale = interpolate(progress, [0, 12], [0.4, 2.2], {
      easing: emphasizedDecelerate,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    rippleOpacity = interpolate(progress, [0, 8, 16], [0.55, 0.28, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translate3d(${currentX}px, ${currentY}px, 0) scale(${clickScale})`,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {activeClick && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: -20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'rgba(26, 115, 232, 0.35)',
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        style={{filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.25))'}}
      >
        <path
          d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z"
          fill="#1F1F1F"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
