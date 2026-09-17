import React from 'react';
import { Composition, Folder } from 'remotion';
import { DemoForgeDemo } from './DemoForgeDemo';
import { HybridWalkthrough } from './HybridWalkthrough';
import { Opening } from './scenes/Opening';
import { RepoEntry } from './scenes/RepoEntry';
import { Storyboard } from './scenes/Storyboard';
import { ApproveRender } from './scenes/ApproveRender';
import { ReviewExport } from './scenes/ReviewExport';
import { Closing } from './scenes/Closing';
import { HybridIntro } from './scenes/HybridIntro';
import { HybridOutro } from './scenes/HybridOutro';
import { DEFAULT_HYBRID_SPEC, getTotalFrames } from './lib/hybridSpec';
import { GoogleWalkthrough } from './motion/GoogleWalkthrough';
import { CorporateWalkthrough } from './motion/CorporateWalkthrough';
import googleStoryboard from './motion/storyboard.google.json';
import { FPS, WIDTH, HEIGHT } from './lib/timing';

export const RemotionRoot: React.FC = () => {
  const hybridTotalFrames = getTotalFrames(DEFAULT_HYBRID_SPEC);

  return (
    <>
      <Composition
        id="HybridWalkthrough"
        component={HybridWalkthrough}
        durationInFrames={hybridTotalFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={({ props }) => {
          const spec = (props && 'shots' in props ? props : (props as any)?.spec) || DEFAULT_HYBRID_SPEC;
          if (spec && spec.shots && Array.isArray(spec.shots)) {
            const intro = spec.introDuration ?? 90;
            const outro = spec.outroDuration ?? 120;
            const shotsTotal = spec.shots.reduce(
              (acc: number, s: any) => acc + (s.durationInFrames ?? 210),
              0
            );
            return {
              durationInFrames: intro + shotsTotal + outro,
              props: { spec },
            };
          }
          return { durationInFrames: hybridTotalFrames };
        }}
      />
      <Composition
        id="GoogleWalkthrough"
        component={GoogleWalkthrough}
        durationInFrames={900}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{storyboard: googleStoryboard}}
      />
      <Composition
        id="CorporateWalkthrough"
        component={CorporateWalkthrough}
        durationInFrames={900}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DemoForgeDemo"
        component={DemoForgeDemo}
        durationInFrames={900}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Folder name="Hybrid-Scenes">
        <Composition
          id="HybridIntro"
          component={HybridIntro}
          durationInFrames={DEFAULT_HYBRID_SPEC.introDuration}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="HybridOutro"
          component={HybridOutro}
          durationInFrames={DEFAULT_HYBRID_SPEC.outroDuration}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
      <Folder name="Benchmark-Scenes">
        <Composition
          id="Opening"
          component={Opening}
          durationInFrames={150}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="RepoEntry"
          component={RepoEntry}
          durationInFrames={180}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Storyboard"
          component={Storyboard}
          durationInFrames={210}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="ApproveRender"
          component={ApproveRender}
          durationInFrames={180}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="ReviewExport"
          component={ReviewExport}
          durationInFrames={120}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
        <Composition
          id="Closing"
          component={Closing}
          durationInFrames={60}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
    </>
  );
};
