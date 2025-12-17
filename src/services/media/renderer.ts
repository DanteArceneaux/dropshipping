import path from 'path';
import fs from 'fs/promises';
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
  /**
   * Bundling the Remotion project can be expensive (webpack).
   * Cache the bundle location so multiple renders (or retries) don't rebundle.
   */
  private bundleLocationPromise: Promise<string> | null = null;

  constructor() {
    this.voiceoverService = new VoiceoverService();
  }

  async renderVideo(script: VideoScriptResult, images: string[]): Promise<string> {
    logger.info('Starting video rendering process...');

    // Step 1: Prepare scene assets (voiceovers + timing)
    const scenesData = await this.prepareScenes(script, images);

    // Step 2: Bundle Remotion project
    const bundleLocation = await this.bundleProject();

    // IMPORTANT:
    // We generate audio files dynamically (public/audio/...) for each render.
    // If we cache the bundle, the bundle's copied `public/` folder can become stale.
    // We sync dynamic assets into the bundle before rendering so assets resolve.
    await this.syncDynamicPublicAssets(bundleLocation, scenesData);

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
    if (this.bundleLocationPromise) {
      return this.bundleLocationPromise;
    }

    const entryPoint = path.resolve(process.cwd(), 'src/video/index.ts');

    logger.info('Bundling Remotion project...');
    
    this.bundleLocationPromise = bundle({
      entryPoint,
      webpackOverride: (config: WebpackConfiguration) => config,
    });

    return this.bundleLocationPromise;
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

    // Ensure output directory exists on clean machines.
    const outDir = path.resolve(process.cwd(), 'out');
    await fs.mkdir(outDir, { recursive: true });

    const outputLocation = path.resolve(
      outDir,
      `video-${Date.now()}.mp4`
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

  private async syncDynamicPublicAssets(
    bundleLocation: string,
    scenesData: SceneData[]
  ): Promise<void> {
    // The bundle output contains a `public/` directory which Remotion serves as `/public/*`.
    // We copy the dynamically generated audio into that directory so `staticFile()` can find it.
    const bundlePublicDir = path.join(bundleLocation, 'public');

    for (const scene of scenesData) {
      // Sync local audio assets only.
      if (scene.audio.startsWith('http')) continue;

      const rel = scene.audio.replace(/^\//, ''); // "/audio/x.mp3" -> "audio/x.mp3"
      const src = path.resolve(process.cwd(), 'public', rel);
      const dest = path.join(bundlePublicDir, rel);

      try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
      } catch (err) {
        logger.warn(`Failed to sync audio asset into bundle: ${rel} (${err})`);
      }
    }
  }
}

