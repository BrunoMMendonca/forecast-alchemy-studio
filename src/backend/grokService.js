import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Grok-3 API configuration
const GROK_API_KEY = process.env.GROK_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load system messages from config files
const systemMessageWithReasoning = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_system_message_with_reasoning.txt'), 'utf-8');
const systemMessageWithoutReasoning = fs.readFileSync(path.join(__dirname, 'config/CSVImport/ai_csv_system_message_without_reasoning.txt'), 'utf-8');

// Initialize OpenAI client for Grok-3
const client = new OpenAI({
  apiKey: GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Helper function to call Grok-3 API with reasoning capture
async function callGrokAPI(prompt, maxTokens = 4000, includeReasoning = false) {
  try {
    const systemMessage = includeReasoning 
      ? systemMessageWithReasoning
      : systemMessageWithoutReasoning;

    const completion = await client.chat.completions.create({
      model: "grok-3",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.1
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Grok API:', error);
    throw error;
  }
}

export { callGrokAPI };
