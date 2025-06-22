import OpenAI from 'openai';

// Grok-3 API configuration
const GROK_API_KEY = process.env.GROK_API_KEY || 'your-grok-api-key-here';

// Initialize OpenAI client for Grok-3
const client = new OpenAI({
  apiKey: GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Helper function to call Grok-3 API with reasoning capture
async function callGrokAPI(prompt, maxTokens = 4000, includeReasoning = false) {
  try {
    const systemMessage = includeReasoning 
      ? "You are a CSV data transformation expert. Always provide detailed reasoning for your transformations, including what patterns you detected, what decisions you made, and why. Return your response in JSON format with 'reasoning' and 'data' fields."
      : "You are a CSV data transformation expert. Transform the following CSV data according to the instructions.";

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
