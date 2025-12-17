import React from 'react';
import { Sequence, Series } from 'remotion';
import { Scene, SceneProps } from './Scene';

export interface AdCompositionProps {
  scenes: SceneProps[];
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



