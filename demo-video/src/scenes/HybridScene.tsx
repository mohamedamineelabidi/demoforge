import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion';
import { HybridShot } from '../lib/hybridSpec';
import { BrowserFrame } from '../components/BrowserFrame';
import { DynamicCamera } from '../components/DynamicCamera';
import { ActionCallout } from '../components/ActionCallout';
import { emphasizedDecelerate, standard } from '../lib/easing';
import { COLORS, FONT } from '../lib/timing';

interface HybridSceneProps {
  shot: HybridShot;
}

const ENTER = Easing.bezier(0.16, 1, 0.3, 1);
const FRAME_W = 1600;
const FRAME_H = 816; // BrowserFrame body (860 - 44 header), 16:9-friendly
const SRC_W = 1280;
const SRC_H = 720;
const SAFE_LEFT = 160; // (1920-1600)/2 aligns chip with frame edge

const StepChip: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      backgroundColor: COLORS.obsidian,
      color: '#FFFFFF',
      fontFamily: FONT,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '0.04em',
      padding: '9px 18px',
      borderRadius: 999,
      boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
    }}
  >
    <span>{label}</span>
  </div>
);

const BenefitCaption: React.FC<{ text: string; local: number }> = ({ text, local }) => (
  <div
    style={{
      opacity: interpolate(local, [8, 22], [0, 1], {
        easing: ENTER,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
      translate: `0px ${interpolate(local, [8, 22], [16, 0], {
        easing: ENTER,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })}`,
      backgroundColor: 'rgba(12,13,14,0.92)',
      color: '#FFFFFF',
      fontFamily: FONT,
      fontSize: 20,
      fontWeight: 500,
      padding: '12px 28px',
      borderRadius: 999,
      letterSpacing: '-0.01em',
      maxWidth: 1400,
      textAlign: 'center',
    }}
  >
    {text}
  </div>
);

const GlowRing: React.FC<{
  x: number;
  y: number;
  size: number;
  local: number;
  start: number;
  end: number;
  color?: string;
}> = ({ x, y, size, local, start, end, color = COLORS.accent }) => {
  if (local < start || local > end) {
    return null;
  }
  const t = local - start;
  const span = Math.max(1, end - start);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${color}`,
        boxShadow: `0 0 0 8px ${color}22, 0 0 32px ${color}55`,
        opacity: interpolate(t, [0, 6, span - 6, span], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
        scale: `${interpolate(t, [0, span], [0.7, 1.25], {
          easing: emphasizedDecelerate,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}`,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
};

export const HybridScene: React.FC<HybridSceneProps> = ({ shot }) => {
  const frame = useCurrentFrame();

  // Corporate grammar: slow push-in handled by DynamicCamera (45f ramp + hold).
  // Entrance rise/fade mirrors Corporate BeatShell for preview/export parity.
  const rise = interpolate(frame, [0, 24], [36, 0], {
    easing: ENTER,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  void standard;

  const frameOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Calculate startFrom in frames for video trimming
  const startFromFrames = Math.max(0, Math.round(shot.sourceInSeconds * 30));

  // Accurate GlowRing placement: map source-pixel focus -> BrowserFrame body pixels.
  // Body is FRAME_W x FRAME_H; footage is objectFit:cover so this is exact when
  // aspect ratios match (1280/720 = 1.778 vs 1640/846 = 1.938 -> cover crops sides
  // slightly, error bounded to ~8%. Center focuses stay accurate).
  const ringX = (shot.focus.x / SRC_W) * FRAME_W;
  const ringY = (shot.focus.y / SRC_H) * FRAME_H;
  const ringStart = shot.badge?.frame ?? 20;
  const ringEnd = ringStart + 50;
  const ringColor = shot.badge?.color ?? COLORS.emerald;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.canvas,
        fontFamily: FONT,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting (corporate) */}
      <div
        style={{
          position: 'absolute',
          top: '-12%',
          left: '20%',
          width: '60%',
          height: 420,
          background:
            'radial-gradient(ellipse at center, rgba(99,102,241,0.10) 0%, rgba(249,250,252,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Step chip top-left, aligned to frame edge (safe area) */}
      <div style={{ position: 'absolute', top: 48, left: SAFE_LEFT, zIndex: 30 }}>
        <StepChip label={shot.badge?.text ?? shot.title} />
      </div>

      {/* Main: Browser Frame with real footage + dynamic camera */}
      <div
        style={{
          position: 'relative',
          translate: `0px ${rise}px`,
          opacity: frameOpacity,
          zIndex: 20,
        }}
      >
        <BrowserFrame width={1600} height={860} url={`http://127.0.0.1:8000/#${shot.id}`}>
          <DynamicCamera
            focus={shot.focus}
            zoomAmount={shot.zoomAmount ?? 1.2}
            durationInFrames={shot.durationInFrames}
            rampFrames={45}
            baseWidth={FRAME_W}
            baseHeight={FRAME_H}
            sourceWidth={SRC_W}
            sourceHeight={SRC_H}
          >
            <OffthreadVideo
              src={staticFile(shot.source)}
              startFrom={startFromFrames}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </DynamicCamera>
        </BrowserFrame>

        {/* Accurate action highlight: GlowRing over focus + badge */}
        <GlowRing
          x={ringX}
          y={ringY + 44} // + browser header offset
          size={130}
          local={frame}
          start={ringStart}
          end={ringEnd}
          color={ringColor}
        />
        {shot.badge && (
          <ActionCallout
            text={shot.title}
            startFrame={shot.badge.frame}
            color={shot.badge.color ?? '#6366F1'}
            top={shot.badge.y ?? 40}
            right={shot.badge.x ?? 40}
          />
        )}
      </div>

      {/* Benefit caption bottom-center, inside safe area */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 30,
          padding: '0 160px',
        }}
      >
        <BenefitCaption text={shot.caption} local={frame} />
      </div>
    </AbsoluteFill>
  );
};

