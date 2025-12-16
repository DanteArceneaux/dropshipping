import { openai, MODELS } from '../../shared/llm';
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
      const response = await openai.chat.completions.create({
        model: MODELS.FAST,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('Empty response from LLM');

      const result = JSON.parse(content) as DiscoveryResult;
      return result;

    } catch (error) {
      logger.error(`Discovery analysis failed: ${error}`);
      throw error;
    }
  }
}

