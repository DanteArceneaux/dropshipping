import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { safeJsonParse } from '../../shared/safe-json';

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

      try {
        const result = safeJsonParse<CopywritingResult>(content, { context: 'CopywriterAgent' });
        this.assertValidResult(result);
        return result;
      } catch (parseErr) {
        const retryContent = await generateText(
          systemPrompt,
          `${userContent}\n\nReturn ONLY a single JSON object. No markdown. No code fences. No extra commentary.`,
          'SMART',
          true
        );
        const result = safeJsonParse<CopywritingResult>(retryContent, { context: 'CopywriterAgent:retry' });
        this.assertValidResult(result);
        return result;
      }

    } catch (error) {
      logger.error(`Copywriting generation failed: ${error}`);
      throw error;
    }
  }

  private assertValidResult(result: any): asserts result is CopywritingResult {
    const isString = (v: unknown) => typeof v === 'string' && v.length > 0;
    const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');

    if (!result || typeof result !== 'object') {
      throw new Error('CopywriterAgent: invalid JSON payload (not an object)');
    }
    if (!isString(result.title)) {
      throw new Error('CopywriterAgent: missing/invalid title');
    }
    if (!isString(result.description_md)) {
      throw new Error('CopywriterAgent: missing/invalid description_md');
    }
    if (!isStringArray(result.ad_hooks)) {
      throw new Error('CopywriterAgent: missing/invalid ad_hooks');
    }
  }
}

