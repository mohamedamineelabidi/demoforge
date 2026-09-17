/**
 * Specification and data contract for the Hybrid Recorded Demo Engine.
 * Combines real captured UI footage with Google Workspace-style motion design.
 */

export interface ActionBadge {
  text: string;
  frame: number;
  color?: string;
  x?: number;
  y?: number;
}

export interface HybridShot {
  id: string;
  title: string;
  caption: string;
  source: string;
  durationInFrames: number;
  sourceInSeconds: number;
  focus: {
    x: number;
    y: number;
  };
  zoomAmount?: number;
  badge?: ActionBadge;
  url?: string;
}

export interface HybridDemoSpec {
  title: string;
  tagline: string;
  fps: number;
  width: number;
  height: number;
  introDuration: number;
  outroDuration: number;
  shots: HybridShot[];
  targetUrl?: string;
}

/**
 * Curated 45-second (1350 frames @ 30fps) flagship product walkthrough
 * using real DemoForge capture footage from owned-ui-demo-fast.
 */
export const DEFAULT_HYBRID_SPEC: HybridDemoSpec = {
  title: 'DemoForge',
  tagline: 'Source-Linked Release Demos for Developer Tools',
  fps: 30,
  width: 1920,
  height: 1080,
  introDuration: 90, // 3.0s
  outroDuration: 150, // 5.0s
  shots: [
    {
      id: 'library',
      title: 'Project Library',
      caption: 'Select an authorized project draft or connect a GitHub repository.',
      source: 'footage/library.webm',
      durationInFrames: 180, // 6.0s
      sourceInSeconds: 3.0,
      focus: { x: 700, y: 540 },
      zoomAmount: 1.15,
      badge: {
        text: '1. Project Library',
        frame: 20,
        color: '#6366F1',
        x: 180,
        y: 120,
      },
    },
    {
      id: 'canvas',
      title: 'Storyboard Canvas',
      caption: 'Edit scene captions with instant preview and banned-phrase copy lint.',
      source: 'footage/canvas.webm',
      durationInFrames: 240, // 8.0s
      sourceInSeconds: 2.8,
      focus: { x: 1150, y: 606 },
      zoomAmount: 1.25,
      badge: {
        text: '2. Live Caption Sync',
        frame: 25,
        color: '#10B981',
        x: 180,
        y: 120,
      },
    },
    {
      id: 'frames',
      title: 'Frame Editor',
      caption: 'Fine-tune start/end bounds and trim points on the 30 fps timeline.',
      source: 'footage/frames.webm',
      durationInFrames: 240, // 8.0s
      sourceInSeconds: 2.8,
      focus: { x: 964, y: 664 },
      zoomAmount: 1.25,
      badge: {
        text: '3. Frame-Accurate Timeline',
        frame: 25,
        color: '#F59E0B',
        x: 180,
        y: 120,
      },
    },
    {
      id: 'approvals',
      title: 'Cryptographic Approvals',
      caption: 'Every claim, scenario and storyboard is bound to an immutable SHA-256 hash.',
      source: 'footage/approvals.webm',
      durationInFrames: 210, // 7.0s
      sourceInSeconds: 2.7,
      focus: { x: 760, y: 420 },
      zoomAmount: 1.20,
      badge: {
        text: '4. SHA-256 Hash Gate',
        frame: 20,
        color: '#237454',
        x: 180,
        y: 120,
      },
    },
    {
      id: 'review',
      title: 'Quality Review & Export',
      caption: 'Automated technical checks verify duration, resolution and privacy before export.',
      source: 'footage/review.webm',
      durationInFrames: 240, // 8.0s
      sourceInSeconds: 2.8,
      focus: { x: 760, y: 420 },
      zoomAmount: 1.18,
      badge: {
        text: '5. Pre-Export Gate',
        frame: 25,
        color: '#10B981',
        x: 180,
        y: 120,
      },
    },
  ],
};

export const getTotalFrames = (spec: HybridDemoSpec): number => {
  const shotTotal = spec.shots.reduce((sum, shot) => sum + shot.durationInFrames, 0);
  return spec.introDuration + shotTotal + spec.outroDuration;
};

