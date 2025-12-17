import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';

export interface DiscoveryResult {
  product_name: string;
  viral_score: number;
  sentiment_score: number;
  verdict: 'APPROVE' | 'REJECT';
  reasoning: string;
}

export class DiscoveryAgent {
  async analyze(product: any): Promise<DiscoveryResult> {
    const systemPrompt = await loadPrompt('Discovery');

    const userContent = `
    Analyze this product candidate:
    Title: ${product.title}
    Description: ${product.description}
    Stats: ${JSON.stringify(product.rawStats)}
    URL: ${product.externalUrl}
    
    Return JSON only.
    `;

    try {
      const content = await generateText(systemPrompt, userContent, 'FAST', true);
      
      const result = JSON.parse(content) as DiscoveryResult;
      return result;

    } catch (error) {
      logger.error(`Discovery analysis failed: ${error}`);
      throw error;
    }
  }
}

