import { describe, expect, it } from "vitest";
import { captionAtFrame, motionAtFrame, motionEase, playbackReducer, sceneRanges } from "./motion";

const ranges = [
  { start: 0, end: 180, zoom: 1.15, trimIn: 45 },
  { start: 180, end: 660, zoom: 1.5, trimIn: 210 },
  { start: 660, end: 900, zoom: 1, trimIn: 750 },
];

describe("frame motion", () => {
  it("keeps hard cuts visible and slow pushes within the reference profile", () => {
    for (let frame = 0; frame < 900; frame++) {
      const sample = motionAtFrame(ranges, frame);
      expect(sample.opacity).toBe(1);
      expect(sample.translateY).toBe(0);
      expect(sample.scale).toBeLessThanOrEqual(1.12);
    }
    expect(sceneRanges([{ frames: 180 }, { frames: 480 }, { frames: 240 }]))
      .toEqual([{ frames: 180, start: 0, end: 180 }, { frames: 480, start: 180, end: 660 },
        { frames: 240, start: 660, end: 900 }]);
  });

  it("samples cubic-bezier(.22, 1, .36, 1), not a cubic-out approximation", () => {
    expect(motionEase(0)).toBe(0);
    expect(motionEase(1)).toBe(1);
    expect(motionEase(0.3425)).toBeCloseTo(0.875, 7);
    expect(motionEase(0.5)).toBeCloseTo(0.96138255, 6);
    expect(motionAtFrame([{ start: 0, end: 101, zoom: 1.12 }], 50).scale)
      .toBeCloseTo(1 + 0.12 * motionEase(0.5), 7);
  });

  it("reveals literal captions at one character per frame with a 60-character limit", () => {
    expect(captionAtFrame("Draft <text>", 0)).toBe("");
    expect(captionAtFrame("Draft <text>", 1)).toBe("D");
    expect(captionAtFrame("Draft <text>", 7)).toBe("Draft <");
    expect(captionAtFrame("x".repeat(80), 900)).toBe("x".repeat(60));
    expect(captionAtFrame("Literal caption", 0, true)).toBe("Literal caption");
    expect(captionAtFrame("Draft", NaN)).toBe("");
  });

  it("is repeatable through forward, reverse and random-access seeks", () => {
    const frames = [0, 1, 12, 90, 179, 180, 181, 390, 659, 660, 899];
    const expected = new Map(frames.map(frame => [frame, motionAtFrame(ranges, frame)]));
    for (const frame of [...frames].reverse().concat([390, 12, 660, 0, 899, 180])) {
      expect(motionAtFrame(ranges, frame)).toEqual(expected.get(frame));
    }
    expect(expected.get(1)).not.toEqual(expected.get(90));
  });

  it("uses half-open ranges and source trim plus local frames", () => {
    expect(motionAtFrame(ranges, 179)).toMatchObject({ sceneIndex: 0, localFrame: 179, sourceFrame: 224 });
    expect(motionAtFrame(ranges, 180)).toMatchObject({ sceneIndex: 1, localFrame: 0, sourceFrame: 210 });
    expect(motionAtFrame(ranges, 900)).toMatchObject({ frame: 899, sceneIndex: 2 });
    expect(motionAtFrame(ranges, -1).frame).toBe(0);
  });

  it("bounds transitions, progress, translation and zoom at every frame", () => {
    for (let frame = -2; frame <= 902; frame++) {
      const sample = motionAtFrame(ranges, frame);
      for (const value of [sample.progress, sample.opacity, sample.reveal]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect(sample.scale).toBeGreaterThanOrEqual(1);
      expect(sample.scale).toBeLessThanOrEqual(1.5);
      expect(Math.abs(sample.translateY)).toBeLessThanOrEqual(48);
    }
  });

  it("never emits NaN for empty, zero, inverted or nonfinite inputs", () => {
    for (const input of [[], [{ start: 0, end: 0 }], [{ start: 8, end: 2 }],
      [{ start: NaN, end: Infinity }], [{ start: 0, end: 1, zoom: NaN, trimIn: Infinity }]]) {
      for (const frame of [NaN, Infinity, -Infinity, -9, 0, 9]) {
        const sample = motionAtFrame(input, frame);
        expect(Object.values(sample).every(value => Number.isFinite(value))).toBe(true);
      }
    }
    expect(motionAtFrame([], 0)).toMatchObject({ sceneIndex: -1, totalFrames: 0, frame: 0 });
    expect(motionAtFrame([{ start: 0, end: 1, zoom: 7 }], 0).scale).toBeLessThanOrEqual(1.5);
  });

  it("keeps scene durations instead of silently stretching them to 900", () => {
    expect(sceneRanges([{ frames: 180 }, { frames: 480 }, { frames: 240 }]).at(-1)?.end).toBe(900);
    expect(sceneRanges([{ frames: 12 }, { frames: 0 }, { frames: NaN }]).map(range => range.end))
      .toEqual([12, 12, 12]);
  });
});

describe("preview transport", () => {
  it("pauses without losing the frame and ignores subsequent ticks", () => {
    const paused = playbackReducer({ frame: 37, playing: true }, { type: "pause", total: 900 });
    expect(paused).toEqual({ frame: 37, playing: false });
    expect(playbackReducer(paused, { type: "tick", frame: 99, total: 900 })).toEqual(paused);
  });

  it("restarts paused, scrubs paused and stops on the last valid frame", () => {
    expect(playbackReducer({ frame: 899, playing: true }, { type: "restart", total: 900 }))
      .toEqual({ frame: 0, playing: false });
    expect(playbackReducer({ frame: 24, playing: true }, { type: "seek", frame: 900, total: 900 }))
      .toEqual({ frame: 899, playing: false });
    expect(playbackReducer({ frame: 890, playing: true }, { type: "tick", frame: 900, total: 900 }))
      .toEqual({ frame: 899, playing: false });
    expect(playbackReducer({ frame: 899, playing: false }, { type: "play", total: 900 }))
      .toEqual({ frame: 0, playing: true });
    expect(playbackReducer({ frame: 0, playing: false }, { type: "play", total: 0 }).playing).toBe(false);
  });
});