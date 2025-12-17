import React from 'react';
import { Series } from 'remotion';
import { Scene, SceneProps } from './Scene';

// Re-export for external use
export type SceneData = SceneProps;

export interface AdCompositionProps {
  scenes: SceneData[];
  [key: string]: unknown;
}

export const AdComposition: React.FC<AdCompositionProps> = ({ scenes }) => {
  return (
    <Series>
      {scenes.map((scene, index) => (
        <Series.Sequence key={index} durationInFrames={scene.durationInFrames}>
          <Scene {...scene} />
        </Series.Sequence>
      ))}
    </Series>
  );
};



