import React from 'react';
import { Composition } from 'remotion';
import { AdComposition, AdCompositionProps } from './AdComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Ad"
        component={AdComposition as any}
        durationInFrames={300} // Default 10s @ 30fps (will be overridden)
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
        }}
      />
    </>
  );
};



