import React from 'react';
import {useCurrentFrame} from 'remotion';
import {CameraStage} from './CameraStage';
import {CursorTrack} from './CursorTrack';
import {MockWorkspaceUI} from './MockWorkspaceUI';
import {CalloutBadge} from './CalloutBadge';
import {VideoStoryboard} from './types';

/**
 * Google-style walkthrough composition for TASK-082 benchmark.
 * Cursor lives inside the transformed canvas so pan/zoom and pointer stay
 * in sync. Badges stay fixed to the camera view so text remains sharp.
 */
export const GoogleWalkthrough: React.FC<{storyboard: VideoStoryboard}> = ({
  storyboard,
}) => {
  const frame = useCurrentFrame();
  const isNotesActive = frame >= 65;

  return (
    <div style={{position: 'relative', width: 1920, height: 1080}}>
      <CameraStage cameraTrack={storyboard.cameraTrack}>
        <MockWorkspaceUI isNotesActive={isNotesActive} />
        <CursorTrack track={storyboard.cursorTrack} />
      </CameraStage>
      {storyboard.badgeCues.map((cue, idx) => (
        <CalloutBadge
          key={idx}
          text={cue.text}
          startFrame={cue.startFrame}
          durationFrames={cue.durationFrames}
        />
      ))}
    </div>
  );
};
