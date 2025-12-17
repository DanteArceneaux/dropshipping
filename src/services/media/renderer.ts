import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { VideoScriptResult } from '../brain/video';
import { VoiceoverService } from './voiceover';
import { logger } from '../../shared/logger';
import { AdCompositionProps, SceneData } from '../../video/AdComposition';
import type { WebpackConfiguration } from '@remotion/bundler';

// ============================================================================
// Constants
// ============================================================================

const FRAMES_PER_SECOND = 30;
const MIN_SCENE_DURATION_SECONDS = 2;
const WORDS_PER_SECOND = 2; // Conservative estimate

// ============================================================================
// Implementation
// ============================================================================

export class VideoRenderer {
  private readonly voiceoverService: VoiceoverService;

  constructor() {
    this.voiceoverService = new VoiceoverService();
  }

  async renderVideo(script: VideoScriptResult, images: string[]): Promise<string> {
    logger.info('Starting video rendering process...');

    // Step 1: Prepare scene assets (voiceovers + timing)
    const scenesData = await this.prepareScenes(script, images);

    // Step 2: Bundle Remotion project
    const bundleLocation = await this.bundleProject();

    // Step 3: Render final video
    const outputLocation = await this.renderToFile(bundleLocation, scenesData);

    logger.info('Video rendering complete!');
    return outputLocation;
  }

  private async prepareScenes(
    script: VideoScriptResult,
    images: string[]
  ): Promise<SceneData[]> {
    const scenes: SceneData[] = [];

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const image = images[i % images.length]; // Cycle images if needed

      logger.debug(`Processing scene ${i + 1}: ${scene.visual}`);

      const audioPath = await this.voiceoverService.generateAudio(scene.audio);
      const durationInFrames = this.estimateDuration(scene.audio);

      scenes.push({
        image,
        audio: audioPath,
        caption: scene.visual,
        durationInFrames
      });
    }

    return scenes;
  }

  private estimateDuration(audioText: string): number {
    const wordCount = audioText.split(/\s+/).length;
    const estimatedSeconds = Math.max(
      MIN_SCENE_DURATION_SECONDS,
      wordCount / WORDS_PER_SECOND
    );
    return Math.ceil(estimatedSeconds * FRAMES_PER_SECOND);
  }

  private async bundleProject(): Promise<string> {
    const entryPoint = path.resolve(process.cwd(), 'src/video/index.ts');

    logger.info('Bundling Remotion project...');
    
    return bundle({
      entryPoint,
      webpackOverride: (config: WebpackConfiguration) => config,
    });
  }

  private async renderToFile(
    bundleLocation: string,
    scenesData: SceneData[]
  ): Promise<string> {
    const inputProps: AdCompositionProps = {
      scenes: scenesData
    };

    const compositionId = 'Ad';
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    const outputLocation = path.resolve(
      process.cwd(),
      `out/video-${Date.now()}.mp4`
    );

    logger.info(`Rendering video to ${outputLocation}...`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps,
    });

    return outputLocation;
  }
}

