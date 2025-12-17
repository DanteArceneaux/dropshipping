
import * as dotenv from 'dotenv';
dotenv.config({ path: 'secrets.env' });
import OpenAI from 'openai';

async function test() {
  console.log('Testing OpenAI Key...');
  const key = process.env.OPENAI_API_KEY;
  console.log('Key starts with:', key?.substring(0, 10));

  if (!key) {
      console.error('No key found!');
      return;
  }

  const client = new OpenAI({ apiKey: key });

  try {
    const start = Date.now();
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, are you working?' }],
    });
    console.log('Response:', response.choices[0].message.content);
    console.log(`Duration: ${Date.now() - start}ms`);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

