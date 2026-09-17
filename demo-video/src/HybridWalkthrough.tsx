import React from 'react';
import { TransitionSeries } from '@remotion/transitions';
import { DEFAULT_HYBRID_SPEC, HybridDemoSpec } from './lib/hybridSpec';
import { HybridIntro } from './scenes/HybridIntro';
import { HybridScene } from './scenes/HybridScene';
import { HybridOutro } from './scenes/HybridOutro';

interface HybridWalkthroughProps {
  spec?: HybridDemoSpec;
}

export const HybridWalkthrough: React.FC<HybridWalkthroughProps> = ({
  spec = DEFAULT_HYBRID_SPEC,
}) => {
  return (
    <TransitionSeries>
      {/* Intro Card */}
      <TransitionSeries.Sequence durationInFrames={spec.introDuration} name="Intro">
        <HybridIntro />
      </TransitionSeries.Sequence>

      {/* Real Recorded UI Shots */}
      {spec.shots.map((shot) => (
        <TransitionSeries.Sequence
          key={shot.id}
          durationInFrames={shot.durationInFrames}
          name={shot.title}
        >
          <HybridScene shot={shot} />
        </TransitionSeries.Sequence>
      ))}

      {/* Outro Card */}
      <TransitionSeries.Sequence durationInFrames={spec.outroDuration} name="Outro">
        <HybridOutro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

