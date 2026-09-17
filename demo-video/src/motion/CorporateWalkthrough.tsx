import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import {emphasizedDecelerate, standard} from '../lib/easing';
import {COLORS, FONT} from '../lib/timing';

/**
 * CorporateWalkthrough - $50k-finish benchmark composition (TASK-082).
 *
 * Google/Apple/OpenAI grammar applied to the DemoForge story:
 * - 6 beats, hard cuts every 4-6 s. No cursor travel; actions land via
 *   jump cut + glow ring + state change (this is what the reference films do).
 * - Slow push-in per beat (1.0 -> <=1.3, 45-frame ramp, then hold).
 * - Step chip top-left + one benefit caption bottom-center per beat.
 * - Hook (0-3 s) + end-card hold (last 4 s).
 * - 100 % vector, offline system fonts, pure function of frame.
 * - Illustrative mock. Not product evidence, never a runtime_observed claim.
 */

const ENTER = Easing.bezier(0.16, 1, 0.3, 1);

const StepChip: React.FC<{index: string; label: string}> = ({index, label}) => (
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
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        backgroundColor: COLORS.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {index}
    </span>
    <span>{label}</span>
  </div>
);

const BenefitCaption: React.FC<{text: string; local: number}> = ({
  text,
  local,
}) => (
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
      fontSize: 21,
      fontWeight: 500,
      padding: '14px 30px',
      borderRadius: 999,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
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
}> = ({x, y, size, local, start, end, color = COLORS.accent}) => {
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

const BeatShell: React.FC<{
  local: number;
  duration: number;
  zoom: number;
  chip: React.ReactNode;
  caption: string;
  children: React.ReactNode;
}> = ({local, duration, zoom, chip, caption, children}) => {
  const push = interpolate(local, [0, 45], [1, zoom], {
    easing: standard,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rise = interpolate(local, [0, 24], [36, 0], {
    easing: ENTER,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fade = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outFade = interpolate(local, [duration - 10, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.canvas,
        fontFamily: FONT,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: Math.min(fade, outFade),
      }}
    >
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
      <div style={{position: 'absolute', top: 64, left: 96}}>{chip}</div>
      <div
        style={{
          scale: `${push}`,
          translate: `0px ${rise}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 64,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <BenefitCaption text={caption} local={local} />
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{
  title: string;
  sub: string;
  accent: string;
  active?: boolean;
  dim?: boolean;
}> = ({title, sub, accent, active, dim}) => (
  <div
    style={{
      width: 380,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      border: `1.5px solid ${active ? accent : COLORS.border}`,
      boxShadow: active
        ? `0 16px 40px rgba(0,0,0,0.12), 0 0 0 6px ${accent}18`
        : '0 8px 24px rgba(0,0,0,0.06)',
        padding: '26px 28px',
      opacity: dim ? 0.55 : 1,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: `${accent}18`,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{width: 18, height: 18, borderRadius: 6, backgroundColor: accent}}
      />
    </div>
    <div style={{fontSize: 22, fontWeight: 700, color: COLORS.foreground}}>
      {title}
    </div>
    <div style={{fontSize: 16, color: COLORS.muted, marginTop: 6}}>{sub}</div>
  </div>
);

const TYPED = 'Every answer links back to source documents.';

function Beat({frame}: {frame: number}) {
  // Hook 0-90
  if (frame < 90) {
    const local = frame;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#FFFFFF',
          fontFamily: FONT,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: interpolate(local, [80, 90], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <div
          style={{
            opacity: interpolate(local, [6, 24], [0, 1], {
              easing: ENTER,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            translate: `0px ${interpolate(local, [6, 24], [24, 0], {
              easing: ENTER,
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: COLORS.accent,
              marginBottom: 18,
            }}
          >
            DEMOFORGE
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: COLORS.foreground,
              lineHeight: 1.05,
            }}
          >
            Release demos
            <br />
            your users will trust.
          </div>
          <div style={{fontSize: 22, color: COLORS.muted, marginTop: 20}}>
            Source-linked. Editable. Approved before export.
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  // Library 90-270
  if (frame < 270) {
    const local = frame - 90;
    const selected = local >= 60;
    return (
      <BeatShell
        local={local}
        duration={180}
        zoom={1.22}
        chip={<StepChip index="1" label="Project library" />}
        caption="Start from an approved project draft."
      >
        <div style={{position: 'relative', display: 'flex', gap: 28}}>
          <Card
            title="Website refresh"
            sub="Draft · 12 scenes"
            accent={COLORS.accent}
            active={selected}
          />
          <Card
            title="API launch"
            sub="Draft · 8 scenes"
            accent={COLORS.emerald}
            dim={selected}
          />
          <Card
            title="Mobile onboarding"
            sub="Draft · 6 scenes"
            accent={COLORS.amber}
            dim={selected}
          />
          <GlowRing
            x={318}
            y={34}
            size={96}
            local={local}
            start={60}
            end={110}
          />
        </div>
      </BeatShell>
    );
  }
  // Caption edit 270-450
  if (frame < 450) {
    const local = frame - 270;
    const chars = Math.floor(
      interpolate(local, [40, 130], [0, TYPED.length], {
        easing: Easing.linear,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    );
    const saved = local >= 140;
    return (
      <BeatShell
        local={local}
        duration={180}
        zoom={1.25}
        chip={<StepChip index="2" label="Edit captions" />}
        caption="Rewrite one line. The timeline stays in sync."
      >
        <div
          style={{
            position: 'relative',
            width: 1080,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            border: `1.5px solid ${COLORS.border}`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.10)',
            padding: '34px 40px',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: COLORS.muted,
              marginBottom: 14,
            }}
          >
            SCENE 2 · FEATURE
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: COLORS.foreground,
              minHeight: 52,
              letterSpacing: '-0.01em',
            }}
          >
            {TYPED.slice(0, chars)}
            <span
              style={{
                opacity: local >= 40 && local < 135 ? 1 : 0,
                color: COLORS.accent,
              }}
            >
              |
            </span>
          </div>
          <div
            style={{
              marginTop: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 30px',
              borderRadius: 999,
              backgroundColor: saved ? COLORS.emerald : COLORS.obsidian,
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            {saved ? 'Saved to scene 2' : 'Save caption'}
          </div>
          <GlowRing
            x={940}
            y={200}
            size={120}
            local={local}
            start={140}
            end={175}
            color={COLORS.emerald}
          />
        </div>
      </BeatShell>
    );
  }
  // Approvals 450-600
  if (frame < 600) {
    const local = frame - 450;
    const approved = local >= 70;
    return (
      <BeatShell
        local={local}
        duration={150}
        zoom={1.2}
        chip={<StepChip index="3" label="Approve exact revisions" />}
        caption="Nothing ships without a hash-bound approval."
      >
        <div style={{position: 'relative', display: 'flex', gap: 28}}>
          {['Storyboard r4', 'Footage r2', 'Export r1'].map((t, i) => {
            const on = approved && i === 0;
            return (
              <div
                key={t}
                style={{
                  width: 330,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  border: `1.5px solid ${on ? COLORS.emerald : COLORS.border}`,
                  boxShadow: on
                    ? '0 16px 40px rgba(0,0,0,0.12)'
                    : '0 8px 24px rgba(0,0,0,0.06)',
                  padding: '26px 28px',
                  opacity: interpolate(local, [i * 14, i * 14 + 14], [0, 1], {
                    easing: ENTER,
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: COLORS.foreground,
                  }}
                >
                  {t}
                </div>
                <div
                  style={{
                    fontFamily:
                      "'Segoe UI Mono', 'Cascadia Code', monospace",
                    fontSize: 14,
                    color: COLORS.muted,
                    marginTop: 8,
                  }}
                >
                  sha256 · {on ? 'a9fa0fa2…' : 'pending…'}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    display: 'inline-block',
                    padding: '8px 20px',
                    borderRadius: 999,
                    backgroundColor: on ? COLORS.emerald : COLORS.inset,
                    color: on ? '#FFFFFF' : COLORS.muted,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {on ? 'Approved' : 'Awaiting review'}
                </div>
              </div>
            );
          })}
          <GlowRing
            x={282}
            y={30}
            size={96}
            local={local}
            start={70}
            end={120}
            color={COLORS.emerald}
          />
        </div>
      </BeatShell>
    );
  }
  // Review/export 600-780
  if (frame < 780) {
    const local = frame - 600;
    const ticks = [30, 55, 80].map((s) =>
      interpolate(local, [s, s + 12], [0, 1], {
        easing: ENTER,
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    );
    return (
      <BeatShell
        local={local}
        duration={180}
        zoom={1.22}
        chip={<StepChip index="4" label="Review and export" />}
        caption="900 frames. Full decode. Then export."
      >
        <div
          style={{
            position: 'relative',
            width: 760,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            border: `1.5px solid ${COLORS.border}`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.10)',
            padding: '32px 38px',
          }}
        >
          {['900 frames · 30 fps · 1920x1080', 'Full decode passed', 'Privacy review passed'].map(
            (t, i) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 0',
                  borderBottom:
                    i < 2 ? `1px solid ${COLORS.borderSub}` : 'none',
                  fontSize: 20,
                  fontWeight: 600,
                  color: COLORS.foreground,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    backgroundColor: COLORS.emerald,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    fontWeight: 800,
                    opacity: ticks[i],
                    scale: `${Math.max(0.4, ticks[i])}`,
                  }}
                >
                  ✓
                </span>
                {t}
              </div>
            ),
          )}
          <GlowRing
            x={660}
            y={150}
            size={130}
            local={local}
            start={95}
            end={150}
            color={COLORS.emerald}
          />
        </div>
      </BeatShell>
    );
  }
  // End card 780-900
  const local = frame - 780;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.obsidian,
        fontFamily: FONT,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: interpolate(local, [0, 14], [0, 1], {
          easing: ENTER,
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    >
      <div
        style={{
          translate: `0px ${interpolate(local, [0, 20], [22, 0], {
            easing: ENTER,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#A5B4FC',
            marginBottom: 18,
          }}
        >
          DEMOFORGE
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#FFFFFF',
          }}
        >
          Ship the demo.
        </div>
        <div style={{fontSize: 22, color: '#9CA3AF', marginTop: 16}}>
          Approve the storyboard to render your 30-second cut.
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const CorporateWalkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 1920, height: 1080}}>
      <Beat frame={frame} />
    </div>
  );
};
