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
    
    CRITICAL INSTRUCTION:
    The provided stats might be 0 due to scraper limitations. 
    IF stats are 0 or missing, DO NOT REJECT based on "Viral Velocity".
    Instead, assume the stats are sufficient and judge ONLY on the product concept itself.
    If it is a physical product suitable for dropshipping (gadget, toy, home decor), APPROVE it.
    
    Return JSON only.
    `;

    try {
      // Use FAST (GPT-3.5) for speed and to avoid GPT-4 tier restrictions on new keys
      const content = await generateText(systemPrompt, userContent, 'FAST', true);
      
      const result = JSON.parse(content) as DiscoveryResult;
      
      if (result.verdict === 'REJECT') {
        logger.info(`Discovery Reasoning (REJECT): ${result.reasoning}`);
      }

      return result;

    } catch (error) {
      logger.error(`Discovery analysis failed: ${error}`);
      throw error;
    }
  }
}

