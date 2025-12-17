import React from 'react';
import { Composition } from 'remotion';
import { AdComposition, type AdCompositionProps } from './AdComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition<any, AdCompositionProps>
        id="Ad"
        component={AdComposition}
        // IMPORTANT: This value is overridden by `calculateMetadata` below.
        // We keep it tiny to avoid accidentally truncating renders if someone
        // changes the default and forgets the dynamic duration logic.
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
        }}
        // Dynamically size the composition to fit the generated scenes.
        // Without this, Remotion would render only the first N frames and
        // silently truncate longer scripts.
        calculateMetadata={({ props }) => {
          const totalFrames = (props.scenes ?? []).reduce((sum, scene) => {
            return sum + (scene.durationInFrames ?? 0);
          }, 0);

          return {
            durationInFrames: Math.max(1, totalFrames),
            fps: 30,
          };
        }}
      />
    </>
  );
};
