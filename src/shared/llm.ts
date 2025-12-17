import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

export type LLMProvider = 'openai' | 'gemini' | 'mock';

const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'openai';

// OpenAI Setup
const openaiKey = process.env.OPENAI_API_KEY;
export const openai = new OpenAI({
  apiKey: openaiKey || 'dummy-key',
});

// Gemini Setup
const googleKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(googleKey || 'dummy-key');

// Standardized Interface for simple text generation
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  modelLevel: 'FAST' | 'SMART' = 'SMART',
  jsonMode: boolean = false
): Promise<string> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (provider === 'gemini') {
        return await generateGemini(systemPrompt, userPrompt, modelLevel, jsonMode);
      } else if (provider === 'mock') {
        return await generateMock(systemPrompt, userPrompt, modelLevel, jsonMode);
      } else {
        return await generateOpenAI(systemPrompt, userPrompt, modelLevel, jsonMode);
      }
    } catch (error: any) {
      attempt++;
      logger.warn(`LLM Generation failed (Attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      // Check for rate limits or temporary server errors
      if (error.status === 429 || error.status >= 500 || error.message?.includes('quota') || error.message?.includes('429')) {
        if (attempt >= maxRetries) throw error;
        
        // Extract wait time if available in error message (e.g., "Please retry in 24.8s")
        const waitMatch = error.message?.match(/retry in (\d+(\.\d+)?)s/);
        let delay = Math.pow(2, attempt) * 1000;
        
        if (waitMatch) {
            delay = Math.ceil(parseFloat(waitMatch[1]) * 1000) + 1000; // Wait slightly longer than requested
            logger.info(`Rate limit hit. Waiting ${delay}ms before retry...`);
        } else {
             // Default to longer backoff for 429s: 5s, 10s, 20s
             delay = attempt * 5000;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error; // Non-retriable error
    }
  }
  throw new Error('Max retries exceeded');
}

async function generateGemini(
  system: string,
  user: string,
  level: 'FAST' | 'SMART',
  jsonMode: boolean
): Promise<string> {
  // Attempting gemini-1.5-pro as final fallback before Mock recommendation
  const modelName = 'gemini-1.5-pro';
  
  try {
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: system, // Native system instruction support
        generationConfig: {
            responseMimeType: jsonMode ? "application/json" : "text/plain"
        }
    });

    const result = await model.generateContent(user);
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error(`Gemini generation failed: ${error}`);
    throw error;
  }
}

async function generateOpenAI(
  system: string,
  user: string,
  level: 'FAST' | 'SMART',
  jsonMode: boolean
): Promise<string> {
  const model = level === 'FAST' ? 'gpt-3.5-turbo' : 'gpt-4-turbo';
  
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    logger.error(`OpenAI generation failed: ${error}`);
    throw error;
  }
}

async function generateMock(
  system: string,
  user: string,
  level: 'FAST' | 'SMART',
  jsonMode: boolean
): Promise<string> {
  logger.info('🤖 Generating MOCK LLM response...');
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate latency

  if (jsonMode) {
    // Attempt to guess the desired JSON structure based on the system prompt context
    if (system.includes('e-commerce trend analyst')) {
      return JSON.stringify({
        product_name: "Mock Product",
        viral_score: 85,
        sentiment_score: 90,
        verdict: "APPROVE",
        reasoning: "Mock analysis approved this product."
      });
    }
    if (system.includes('procurement officer')) {
      return JSON.stringify({
        supplier_url: "https://aliexpress.com/item/mock",
        cost_price: 5.00,
        shipping_time_days: "10-15",
        supplier_rating: 4.8,
        is_verified: true
      });
    }
    if (system.includes('TikTok creative strategist')) {
      return JSON.stringify({
        scenes: [
          { timestamp: "0:00-0:05", visual: "Close up of product working", audio: "Stop scrolling! You need to see this." },
          { timestamp: "0:05-0:10", visual: "Problem demonstration", audio: "If you hate dirty dishes, this is for you." },
          { timestamp: "0:10-0:15", visual: "Product solving problem", audio: "It cleans everything instantly." },
          { timestamp: "0:15-0:30", visual: "Call to action", audio: "Link in bio to get yours." }
        ]
      });
    }
    if (system.includes('copywriter')) {
      return JSON.stringify({
        title: "Mock Product Title",
        description_md: "# Best Product\nThis is a mock description.",
        ad_hooks: ["Hook 1", "Hook 2"]
      });
    }
    // Default JSON
    return JSON.stringify({ result: "Mock Data", status: "success" });
  }

  // Copywriter returns Markdown usually
  if (system.includes('Copywriter')) {
    return `# Mock Title\n## Best Product Ever\nThis is a mock description generated because the API is down.\n- Benefit 1\n- Benefit 2`;
  }

  return "This is a mock response from the LLM.";
}

export const MODELS = {
  FAST: 'FAST',
  SMART: 'SMART',
};

