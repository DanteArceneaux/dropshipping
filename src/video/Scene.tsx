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

  const stripLeadingSlash = (p: string) => p.replace(/^\//, '');

  // Handle local static files vs remote URLs.
  // NOTE: `staticFile()` expects a path relative to the `public/` folder,
  // so we normalize leading "/" to avoid path issues.
  const audioSrc = audio.startsWith('http') ? audio : staticFile(stripLeadingSlash(audio));
  const imageSrc = image.startsWith('http') ? image : staticFile(stripLeadingSlash(image));

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <Img
          src={imageSrc}
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

