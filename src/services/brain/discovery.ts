import { generateText, MODELS } from '../../shared/llm';
import { loadPrompt } from '../../shared/prompts';
import { logger } from '../../shared/logger';
import { safeJsonParse } from '../../shared/safe-json';

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

      let result: DiscoveryResult;
      try {
        result = safeJsonParse<DiscoveryResult>(content, { context: 'DiscoveryAgent' });
      } catch (parseErr) {
        // Retry once with stricter formatting instructions.
        const retryContent = await generateText(
          systemPrompt,
          `${userContent}\n\nReturn ONLY a single JSON object. No markdown. No code fences. No extra commentary.`,
          'FAST',
          true
        );
        result = safeJsonParse<DiscoveryResult>(retryContent, { context: 'DiscoveryAgent:retry' });
      }

      this.assertValidResult(result);
      
      if (result.verdict === 'REJECT') {
        logger.info(`Discovery Reasoning (REJECT): ${result.reasoning}`);
      }

      return result;

    } catch (error) {
      logger.error(`Discovery analysis failed: ${error}`);
      throw error;
    }
  }

  private assertValidResult(result: any): asserts result is DiscoveryResult {
    const isNumber = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    const isString = (v: unknown) => typeof v === 'string' && v.length > 0;

    if (!result || typeof result !== 'object') {
      throw new Error('DiscoveryAgent: invalid JSON payload (not an object)');
    }

    if (!isString(result.product_name)) {
      throw new Error('DiscoveryAgent: missing/invalid product_name');
    }
    if (!isNumber(result.viral_score)) {
      throw new Error('DiscoveryAgent: missing/invalid viral_score');
    }
    if (!isNumber(result.sentiment_score)) {
      throw new Error('DiscoveryAgent: missing/invalid sentiment_score');
    }
    if (result.verdict !== 'APPROVE' && result.verdict !== 'REJECT') {
      throw new Error('DiscoveryAgent: missing/invalid verdict');
    }
    if (!isString(result.reasoning)) {
      throw new Error('DiscoveryAgent: missing/invalid reasoning');
    }
  }
}

