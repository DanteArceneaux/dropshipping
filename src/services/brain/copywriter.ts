import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';

export interface CopywritingResult {
  title: string;
  description_md: string;
  ad_hooks: string[];
}

export class CopywriterAgent {
  async generateCopy(product: { title: string; description: string }): Promise<CopywritingResult> {
    logger.info(`Generating copy for: ${product.title}`);

    const systemPrompt = await loadPrompt('Copywriter');
    
    const userContent = `
    Product Title: ${product.title}
    Product Description: ${product.description}
    
    Generate high-converting copy using the PAS framework.
    Return JSON format: { "title": "...", "description_md": "...", "ad_hooks": ["...", "...", "..."] }
    `;

    try {
      const content = await generateText(systemPrompt, userContent, 'SMART', true);

      const result = JSON.parse(content) as CopywritingResult;
      
      return result;

    } catch (error) {
      logger.error(`Copywriting generation failed: ${error}`);
      throw error;
    }
  }
}

