import React from 'react';
import {TransitionSeries} from '@remotion/transitions';
import {Opening} from './scenes/Opening';
import {RepoEntry} from './scenes/RepoEntry';
import {Storyboard} from './scenes/Storyboard';
import {ApproveRender} from './scenes/ApproveRender';
import {ReviewExport} from './scenes/ReviewExport';
import {Closing} from './scenes/Closing';

export const DemoForgeDemo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={150} name="Opening">
        <Opening />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={180} name="RepoEntry">
        <RepoEntry />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={210} name="Storyboard">
        <Storyboard />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={180} name="ApproveRender">
        <ApproveRender />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={120} name="ReviewExport">
        <ReviewExport />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={60} name="Closing">
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
