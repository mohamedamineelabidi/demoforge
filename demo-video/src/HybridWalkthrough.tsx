import React from 'react';
import { TransitionSeries } from '@remotion/transitions';
import { DEFAULT_HYBRID_SPEC, HybridDemoSpec } from './lib/hybridSpec';
import { HybridIntro } from './scenes/HybridIntro';
import { HybridScene } from './scenes/HybridScene';
import { HybridOutro } from './scenes/HybridOutro';

interface HybridWalkthroughProps {
  spec?: HybridDemoSpec;
}

export const HybridWalkthrough: React.FC<HybridWalkthroughProps & Partial<HybridDemoSpec>> = (props) => {
  const spec: HybridDemoSpec =
    props && 'shots' in props && Array.isArray(props.shots)
      ? (props as unknown as HybridDemoSpec)
      : props?.spec || DEFAULT_HYBRID_SPEC;

  return (
    <TransitionSeries>
      {/* Intro Card */}
      <TransitionSeries.Sequence durationInFrames={spec.introDuration} name="Intro">
        <HybridIntro title={spec.title} tagline={spec.tagline} />
      </TransitionSeries.Sequence>

      {/* Real Recorded UI Shots */}
      {spec.shots.map((shot) => (
        <TransitionSeries.Sequence
          key={shot.id}
          durationInFrames={shot.durationInFrames}
          name={shot.title}
        >
          <HybridScene shot={shot} targetUrl={spec.targetUrl} />
        </TransitionSeries.Sequence>
      ))}

      {/* Outro Card */}
      <TransitionSeries.Sequence durationInFrames={spec.outroDuration} name="Outro">
        <HybridOutro title={spec.title} tagline={spec.tagline} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
