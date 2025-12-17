import React from 'react';
import { AbsoluteFill, Img, Sequence, useVideoConfig, Audio, staticFile } from 'remotion';

export interface SceneProps {
  image: string;
  audio: string;
  caption: string;
  durationInFrames: number;
}

export const Scene: React.FC<SceneProps> = ({ image, audio, caption, durationInFrames }) => {
  const { width } = useVideoConfig();

  // Handle local static files vs remote URLs
  const audioSrc = audio.startsWith('http') ? audio : staticFile(audio);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <Img
          src={image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>
      
      {/* Audio Layer */}
      <Audio src={audioSrc} />

      {/* Caption Overlay */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          top: 300, 
        }}
      >
        <div
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 60,
            textAlign: 'center',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '20px',
            borderRadius: '10px',
            maxWidth: width * 0.8,
          }}
        >
          {caption}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

