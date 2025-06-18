const express = require('express');
const cors = require('cors');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Grok-3 API configuration
const GROK_API_KEY = process.env.GROK_API_KEY || 'your-grok-api-key-here';

// Initialize OpenAI client for Grok-3
const client = new OpenAI({
  apiKey: GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Helper function to call Grok-3 API
async function callGrokAPI(prompt, maxTokens = 4000) {
  try {
    const completion = await client.chat.completions.create({
      model: "grok-3",
      messages: [
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

// Helper function to safely apply transformations based on configuration
function applyTransformations(csvData, config) {
  try {
    let result = [...csvData];
    
    for (const operation of config.operations) {
      switch (operation.type) {
        case 'rename_column':
          result = result.map(row => {
            const newRow = { ...row };
            if (newRow[operation.from] !== undefined) {
              newRow[operation.to] = newRow[operation.from];
              delete newRow[operation.from];
            }
            return newRow;
          });
          break;
          
        case 'filter_rows':
          result = result.filter(row => {
            // Simple filtering - can be extended
            if (operation.condition.includes('>')) {
              const [field, value] = operation.condition.split('>').map(s => s.trim());
              return parseFloat(row[field]) > parseFloat(value);
            }
            return true;
          });
          break;
          
        case 'normalize_format':
          if (operation.target === 'long') {
            // Convert wide format to long format
            const dateColumns = Object.keys(result[0]).filter(key => 
              key.toLowerCase().includes('date') || 
              key.toLowerCase().includes('month') ||
              key.toLowerCase().includes('year')
            );
            
            const valueColumns = Object.keys(result[0]).filter(key => 
              key.toLowerCase().includes('sales') || 
              key.toLowerCase().includes('value') ||
              key.toLowerCase().includes('amount')
            );
            
            const normalized = [];
            for (const row of result) {
              for (const dateCol of dateColumns) {
                for (const valueCol of valueColumns) {
                  normalized.push({
                    date: row[dateCol],
                    value: row[valueCol],
                    sku: row.sku || row.product || row.item || 'Unknown'
                  });
                }
              }
            }
            result = normalized;
          }
          break;
          
        case 'remove_columns':
          result = result.map(row => {
            const newRow = { ...row };
            operation.columns.forEach(col => delete newRow[col]);
            return newRow;
          });
          break;
          
        default:
          console.warn(`Unknown operation type: ${operation.type}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error applying transformations:', error);
    throw error;
  }
}

// Endpoint for direct Grok-3 CSV transformation (existing functionality)
app.post('/api/grok-transform', async (req, res) => {
  try {
    const { csvData, instructions } = req.body;
    
    if (!csvData || !instructions) {
      return res.status(400).json({ error: 'Missing csvData or instructions' });
    }

    const prompt = `
You are a CSV data transformation expert. Transform the following CSV data according to the instructions.

CSV Data:
${JSON.stringify(csvData, null, 2)}

Instructions: ${instructions}

Please return ONLY the transformed CSV data as a JSON array of objects. Do not include any explanations or markdown formatting.
`;

    const transformedData = await callGrokAPI(prompt);
    
    // Try to parse the response as JSON
    let parsedData;
    try {
      parsedData = JSON.parse(transformedData);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = transformedData.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Grok response as JSON');
      }
    }

    res.json({ transformedData: parsedData });
  } catch (error) {
    console.error('Error in grok-transform:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for configuration-based processing of large files
app.post('/api/grok-generate-config', async (req, res) => {
  try {
    const { csvChunk, instructions, fileSize } = req.body;
    
    if (!csvChunk || !instructions) {
      return res.status(400).json({ error: 'Missing csvChunk or instructions' });
    }

    const prompt = `
You are a CSV data transformation expert. This is a sample of a large CSV file (${fileSize} bytes) that needs to be processed.

CSV Sample (first few rows):
${JSON.stringify(csvChunk, null, 2)}

Instructions: ${instructions}

Generate a JSON configuration object that describes the transformations needed. The configuration should be an object with an "operations" array.

Available operation types:
- "rename_column": {"type": "rename_column", "from": "old_name", "to": "new_name"}
- "filter_rows": {"type": "filter_rows", "condition": "field > value"}
- "normalize_format": {"type": "normalize_format", "target": "long"}
- "remove_columns": {"type": "remove_columns", "columns": ["col1", "col2"]}

Return ONLY the JSON configuration object. Do not include any explanations or markdown formatting.
`;

    const configResponse = await callGrokAPI(prompt, 2000);
    
    // Try to parse the response as JSON
    let config;
    try {
      config = JSON.parse(configResponse);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = configResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        config = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Grok response as JSON configuration');
      }
    }

    res.json({ config });
  } catch (error) {
    console.error('Error in grok-generate-config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to apply configuration to full CSV
app.post('/api/apply-config', async (req, res) => {
  try {
    const { csvData, config } = req.body;
    
    if (!csvData || !config) {
      return res.status(400).json({ error: 'Missing csvData or config' });
    }

    const transformedData = applyTransformations(csvData, config);
    
    res.json({ transformedData });
  } catch (error) {
    console.error('Error in apply-config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/grok-transform - Direct CSV transformation');
  console.log('  POST /api/grok-generate-config - Generate config for large files');
  console.log('  POST /api/apply-config - Apply config to full CSV');
  console.log('  GET  /api/health - Health check');
}); 