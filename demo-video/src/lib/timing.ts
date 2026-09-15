/** Video dimensions and scene timing constants */

export const FPS = 30;
export const TOTAL_FRAMES = 900;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Safe area insets (scaled from Remotion's 1080px baseline) */
export const SAFE_X = 143;
export const SAFE_Y = 178;

/** Scene layout: 6 scenes totaling 900 frames */
export const SCENES = {
  opening:       {start: 0,   duration: 150, name: 'Opening'},
  repoEntry:     {start: 150, duration: 180, name: 'RepoEntry'},
  storyboard:    {start: 330, duration: 210, name: 'Storyboard'},
  approveRender: {start: 540, duration: 180, name: 'ApproveRender'},
  reviewExport:  {start: 720, duration: 120, name: 'ReviewExport'},
  closing:       {start: 840, duration: 60,  name: 'Closing'},
} as const;

/** DemoForge design tokens */
export const COLORS = {
  canvas:    '#F9FAFC',
  surface:   '#FFFFFF',
  inset:     '#F1F3F7',
  obsidian:  '#0C0D0E',
  foreground:'#202321',
  muted:     '#6B7280',
  accent:    '#6366F1',
  emerald:   '#10B981',
  amber:     '#F59E0B',
  forest:    '#237454',
  border:    '#E5E7EB',
  borderSub: '#F0F0F0',
  danger:    '#EF4444',
  // Capitalized aliases
  Canvas:    '#F9FAFC',
  Surface:   '#FFFFFF',
  Inset:     '#F1F3F7',
  Obsidian:  '#0C0D0E',
  Foreground:'#202321',
  Muted:     '#6B7280',
  Accent:    '#6366F1',
  AccentIndigo: '#6366F1',
  Emerald:   '#10B981',
  Amber:     '#F59E0B',
  Forest:    '#237454',
  Border:    '#E5E7EB',
  BorderSub: '#F0F0F0',
  Danger:    '#EF4444',
} as const;

export const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
export const FONT_MONO = "'Segoe UI Mono', 'Cascadia Code', monospace";

