import OpenAI from 'openai';
import { logger } from './logger';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  logger.warn('OPENAI_API_KEY is not set. LLM features will fail unless mocked.');
}

export const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key', // Allow dummy key for testing/mocking
});

export const MODELS = {
  FAST: 'gpt-3.5-turbo',
  SMART: 'gpt-4-turbo', // or gpt-4o
};

