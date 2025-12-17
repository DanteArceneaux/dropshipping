import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type LLMProvider = 'openai' | 'gemini' | 'mock';
export type ModelLevel = 'FAST' | 'SMART';

interface LLMConfig {
  provider: LLMProvider;
  openaiKey: string | undefined;
  googleKey: string | undefined;
}

// ============================================================================
// Lazy-loaded Clients (only initialized when needed)
// ============================================================================

let _openaiClient: OpenAI | null = null;
let _geminiClient: GoogleGenerativeAI | null = null;

function getConfig(): LLMConfig {
  return {
    provider: (process.env.LLM_PROVIDER as LLMProvider) || 'openai',
    openaiKey: process.env.OPENAI_API_KEY,
    googleKey: process.env.GOOGLE_API_KEY,
  };
}

function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    const key = getConfig().openaiKey;
    if (!key) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    _openaiClient = new OpenAI({ 
      apiKey: key,
      timeout: 30 * 1000 // 30 seconds timeout
    });
  }
  return _openaiClient;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!_geminiClient) {
    const key = getConfig().googleKey;
    if (!key) {
      throw new Error('GOOGLE_API_KEY is not configured');
    }
    _geminiClient = new GoogleGenerativeAI(key);
  }
  return _geminiClient;
}

// Legacy export for voiceover service compatibility
export const openai = {
  get audio() {
    return getOpenAIClient().audio;
  }
};

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate text using the configured LLM provider.
 * Handles retries with exponential backoff for rate limits.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  modelLevel: ModelLevel = 'SMART',
  jsonMode: boolean = false
): Promise<string> {
  const config = getConfig();
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      switch (config.provider) {
        case 'gemini':
          return await generateGemini(systemPrompt, userPrompt, modelLevel, jsonMode);
        case 'mock':
          return await generateMock(systemPrompt, userPrompt, jsonMode);
        case 'openai':
        default:
          return await generateOpenAI(systemPrompt, userPrompt, modelLevel, jsonMode);
      }
    } catch (error: unknown) {
      attempt++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = (error as { status?: number }).status;
      
      logger.warn(`LLM Generation failed (Attempt ${attempt}/${maxRetries}): ${errorMessage}`);
      
      // Check for rate limits or temporary server errors
      const isRetriable = 
        errorStatus === 429 || 
        (errorStatus !== undefined && errorStatus >= 500) || 
        errorMessage.includes('quota') || 
        errorMessage.includes('429');

      if (isRetriable) {
        if (attempt >= maxRetries) throw error;
        
        // Extract wait time if available in error message (e.g., "Please retry in 24.8s")
        const waitMatch = errorMessage.match(/retry in (\d+(\.\d+)?)s/);
        let delay: number;
        
        if (waitMatch) {
          delay = Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1000;
          logger.info(`Rate limit hit. Waiting ${delay}ms before retry...`);
        } else {
          delay = attempt * 5000; // 5s, 10s, 15s
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error; // Non-retriable error
    }
  }
  throw new Error('Max retries exceeded');
}

// ============================================================================
// Provider Implementations
// ============================================================================

async function generateGemini(
  system: string,
  user: string,
  level: ModelLevel,
  jsonMode: boolean
): Promise<string> {
  const genAI = getGeminiClient();
  // Select model based on level: FAST = lighter model, SMART = full model
  const modelName = level === 'FAST' ? 'gemini-2.0-flash-lite' : 'gemini-2.0-flash';
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: system,
      generationConfig: {
        responseMimeType: jsonMode ? 'application/json' : 'text/plain'
      }
    });

    const result = await model.generateContent(user);
    const response = result.response;
    return response.text();
  } catch (error) {
    logger.error(`Gemini generation failed: ${error}`);
    throw error;
  }
}

async function generateOpenAI(
  system: string,
  user: string,
  level: ModelLevel,
  jsonMode: boolean
): Promise<string> {
  const client = getOpenAIClient();
  const model = level === 'FAST' ? 'gpt-3.5-turbo' : 'gpt-4-turbo';
  
  try {
    logger.debug(`[OpenAI] Sending request to ${model}...`);
    const start = Date.now();
    
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // response_format: jsonMode ? { type: 'json_object' } : undefined, // Temporarily disabled to rule out hang issues
    });

    logger.debug(`[OpenAI] Response received in ${Date.now() - start}ms`);
    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error(`OpenAI generation failed: ${error}`);
    throw error;
  }
}

// ============================================================================
// Mock Provider (for development/testing)
// ============================================================================

interface MockSupplierCandidate {
  url: string;
  price?: number;
  rating?: number;
}

async function generateMock(
  system: string,
  user: string,
  jsonMode: boolean
): Promise<string> {
  logger.info('🤖 Generating MOCK LLM response...');
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate latency

  if (jsonMode) {
    return generateMockJSON(system, user);
  }

  // Markdown responses
  if (system.includes('Copywriter')) {
    return `# Mock Title\n## Best Product Ever\nThis is a mock description generated because the API is down.\n- Benefit 1\n- Benefit 2`;
  }

  return 'This is a mock response from the LLM.';
}

function generateMockJSON(system: string, user: string): string {
  // Discovery Agent
  if (system.includes('e-commerce trend analyst')) {
    return JSON.stringify({
      product_name: 'Mock Product',
      viral_score: 85,
      sentiment_score: 90,
      verdict: 'APPROVE',
      reasoning: 'Mock analysis approved this product.'
    });
  }

  // Sourcing Agent - Smart passthrough for real SerpApi data
  if (system.includes('procurement officer')) {
    const extracted = extractSourcingCandidates(user);
    if (extracted) {
      return JSON.stringify({
        supplier_url: extracted.url,
        cost_price: extracted.price || 10.0,
        shipping_time_days: '14-21',
        supplier_rating: extracted.rating || 4.5,
        is_verified: true,
        reasoning: 'Mock LLM selected the best candidate found by SerpApi.'
      });
    }

    return JSON.stringify({
      supplier_url: 'https://aliexpress.com/item/mock',
      cost_price: 5.0,
      shipping_time_days: '10-15',
      supplier_rating: 4.8,
      is_verified: true
    });
  }

  // Video Script Agent
  if (system.includes('TikTok creative strategist')) {
    return JSON.stringify({
      scenes: [
        { timestamp: '0:00-0:05', visual: 'Close up of product working', audio: 'Stop scrolling! You need to see this.' },
        { timestamp: '0:05-0:10', visual: 'Problem demonstration', audio: 'If you hate dirty dishes, this is for you.' },
        { timestamp: '0:10-0:15', visual: 'Product solving problem', audio: 'It cleans everything instantly.' },
        { timestamp: '0:15-0:30', visual: 'Call to action', audio: 'Link in bio to get yours.' }
      ]
    });
  }

  // Copywriter Agent
  if (system.includes('copywriter')) {
    const titleMatch = user.match(/Product Title:\s*(.*)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Mock Product Title';

    return JSON.stringify({
      title: `${title} (Viral Edition)`,
      description_md: `# ${title}\n\nStop scrolling! This is the product you've been waiting for.\n\n## Why you need this:\n- It solves your problems instantly.\n- High quality and durable.\n- Viral sensation on social media.\n\nGet yours now before it sells out!`,
      ad_hooks: ['Stop scrolling!', 'You need to see this', 'Best find of the year']
    });
  }

  // Default
  return JSON.stringify({ result: 'Mock Data', status: 'success' });
}

function extractSourcingCandidates(user: string): MockSupplierCandidate | null {
  try {
    const jsonStart = user.indexOf('[');
    const jsonEnd = user.lastIndexOf(']');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = user.substring(jsonStart, jsonEnd + 1);
      const candidates: MockSupplierCandidate[] = JSON.parse(jsonStr);

      if (Array.isArray(candidates) && candidates.length > 0) {
        return candidates[0];
      }
    }
  } catch (e) {
    logger.warn(`Mock Sourcing extraction failed: ${e}`);
  }
  return null;
}

export const MODELS = {
  FAST: 'FAST',
  SMART: 'SMART',
};

