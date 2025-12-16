import { openai, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { CopywritingResult } from './copywriter';

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
      const response = await openai.chat.completions.create({
        model: MODELS.SMART,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response from LLM');

      const result = JSON.parse(content) as VideoScriptResult;
      
      return result;

    } catch (error) {
      logger.error(`Video script generation failed: ${error}`);
      throw error;
    }
  }
}

