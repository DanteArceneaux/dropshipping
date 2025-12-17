import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { CopywritingResult } from './copywriter';
import { safeJsonParse } from '../../shared/safe-json';

export interface VideoScene {
  timestamp: string;
  visual: string;
  audio: string;
}

export interface VideoScriptResult {
  scenes: VideoScene[];
}

export class VideoScriptAgent {
  async generateScript(product: { title: string; copy: CopywritingResult }): Promise<VideoScriptResult> {
    logger.info(`Generating video script for: ${product.title}`);

    const systemPrompt = await loadPrompt('Video');
    
    const userContent = `
    Product: ${product.title}
    Hooks: ${product.copy.ad_hooks.join(', ')}
    Description: ${product.copy.description_md}
    
    Generate a 15-30 second viral TikTok script using the Hook-Body-CTA structure.
    Return JSON format: { "scenes": [ { "timestamp": "0:00-0:03", "visual": "...", "audio": "..." } ] }
    `;

    try {
      const content = await generateText(systemPrompt, userContent, 'SMART', true);

      try {
        const result = safeJsonParse<VideoScriptResult>(content, { context: 'VideoScriptAgent' });
        this.assertValidResult(result);
        return result;
      } catch (parseErr) {
        const retryContent = await generateText(
          systemPrompt,
          `${userContent}\n\nReturn ONLY a single JSON object. No markdown. No code fences. No extra commentary.`,
          'SMART',
          true
        );
        const result = safeJsonParse<VideoScriptResult>(retryContent, { context: 'VideoScriptAgent:retry' });
        this.assertValidResult(result);
        return result;
      }

    } catch (error) {
      logger.error(`Video script generation failed: ${error}`);
      throw error;
    }
  }

  private assertValidResult(result: any): asserts result is VideoScriptResult {
    if (!result || typeof result !== 'object') {
      throw new Error('VideoScriptAgent: invalid JSON payload (not an object)');
    }

    if (!Array.isArray(result.scenes)) {
      throw new Error('VideoScriptAgent: missing/invalid scenes array');
    }

    for (const [idx, scene] of result.scenes.entries()) {
      if (!scene || typeof scene !== 'object') {
        throw new Error(`VideoScriptAgent: invalid scene at index ${idx}`);
      }
      if (typeof scene.timestamp !== 'string') {
        throw new Error(`VideoScriptAgent: missing/invalid timestamp at index ${idx}`);
      }
      if (typeof scene.visual !== 'string' || scene.visual.length === 0) {
        throw new Error(`VideoScriptAgent: missing/invalid visual at index ${idx}`);
      }
      if (typeof scene.audio !== 'string' || scene.audio.length === 0) {
        throw new Error(`VideoScriptAgent: missing/invalid audio at index ${idx}`);
      }
    }
  }
}

