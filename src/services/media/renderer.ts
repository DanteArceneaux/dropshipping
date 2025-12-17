import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { VideoScriptResult } from '../brain/video';
import { VoiceoverService } from './voiceover';
import { logger } from '../../shared/logger';
import { AdCompositionProps } from '../../video/AdComposition';

export class VideoRenderer {
  private voiceoverService: VoiceoverService;

  constructor() {
    this.voiceoverService = new VoiceoverService();
  }

  async renderVideo(script: VideoScriptResult, images: string[]): Promise<string> {
    logger.info('Starting video rendering process...');

    // 1. Prepare assets (voiceovers)
    const scenesData = [];
    
    // We loop through scenes. If we have more scenes than images, we reuse images.
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const image = images[i % images.length]; // Cycle images
      
      logger.debug(`Processing scene ${i + 1}: ${scene.visual}`);

      // Generate TTS
      const audioPath = await this.voiceoverService.generateAudio(scene.audio);

      // Estimate duration: 1 sec per 15 chars + buffer, or use a fixed calculation
      // In a real app, we would get exact duration of the mp3 file using `music-metadata` or `mp3-duration`
      // For MVP, we estimate: 30 frames = 1 second. Avg speaking rate ~150wpm.
      const wordCount = scene.audio.split(' ').length;
      const estimatedSeconds = Math.max(2, wordCount * 0.5); // Min 2 seconds
      const durationInFrames = Math.ceil(estimatedSeconds * 30);

      scenesData.push({
        image,
        audio: audioPath,
        caption: scene.visual, // Using visual description as caption for now, ideally strictly the speech
        durationInFrames
      });
    }

    // 2. Bundle Remotion project
    const entryPoint = path.resolve(process.cwd(), 'src/video/index.ts');
    
    // Create entry point if not exists (Remotion needs an index that exports registerRoot)
    // We will create it dynamically or assume it exists. Let's create it in step 5 if needed.
    // Actually, let's just point to Root.tsx if we setup correctly, but standard is index.ts
    
    logger.info('Bundling Remotion project...');
    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config, // Default
    });

    // 3. Render
    const inputProps: AdCompositionProps & Record<string, unknown> = {
      scenes: scenesData
    };

    const compositionId = 'Ad';
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    const outputLocation = path.resolve(process.cwd(), `out/video-${Date.now()}.mp4`);

    logger.info(`Rendering video to ${outputLocation}...`);
    
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps,
    });

    logger.info('Video rendering complete!');
    return outputLocation;
  }
}

