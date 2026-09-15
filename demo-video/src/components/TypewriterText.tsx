import React from 'react';
import { useCurrentFrame } from 'remotion';

export const TypewriterText: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, charsPerFrame = 0.5, style }) => {
  const frame = useCurrentFrame();
  const visibleChars = Math.max(0, Math.floor((frame - startFrame) * charsPerFrame));
  const displayText = text.slice(0, visibleChars);
  const showCursor = Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style}>
      {displayText}
      <span style={{ opacity: showCursor ? 1 : 0 }}>|</span>
    </span>
  );
};
