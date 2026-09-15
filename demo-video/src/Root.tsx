import React from 'react';
import {Composition, Folder} from 'remotion';
import {DemoForgeDemo} from './DemoForgeDemo';
import {Opening} from './scenes/Opening';
import {RepoEntry} from './scenes/RepoEntry';
import {Storyboard} from './scenes/Storyboard';
import {ApproveRender} from './scenes/ApproveRender';
import {ReviewExport} from './scenes/ReviewExport';
import {Closing} from './scenes/Closing';
import {FPS, WIDTH, HEIGHT, TOTAL_FRAMES, SCENES} from './lib/timing';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="DemoForge-Scenes">
        <Composition id="Opening" component={Opening}
          durationInFrames={150} fps={30} width={1920} height={1080} />
        <Composition id="RepoEntry" component={RepoEntry}
          durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="Storyboard" component={Storyboard}
          durationInFrames={210} fps={30} width={1920} height={1080} />
        <Composition id="ApproveRender" component={ApproveRender}
          durationInFrames={180} fps={30} width={1920} height={1080} />
        <Composition id="ReviewExport" component={ReviewExport}
          durationInFrames={120} fps={30} width={1920} height={1080} />
        <Composition id="Closing" component={Closing}
          durationInFrames={60} fps={30} width={1920} height={1080} />
      </Folder>
      <Composition id="DemoForgeDemo" component={DemoForgeDemo}
        durationInFrames={900} fps={30} width={1920} height={1080} />
    </>
  );
};
