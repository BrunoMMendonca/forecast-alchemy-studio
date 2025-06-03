
export interface GrokOptimizationRequest {
  modelType: string;
  historicalData: number[];
  currentParameters: Record<string, number>;
  seasonalPeriod?: number;
  targetMetric: 'mape' | 'mae' | 'rmse';
}

export interface GrokOptimizationResponse {
  optimizedParameters: Record<string, number>;
  expectedAccuracy: number;
  confidence: number;
  reasoning: string;
}

export interface GrokModelRecommendation {
  recommendedModel: string;
  confidence: number;
  reasoning: string;
  alternativeModels: Array<{
    model: string;
    score: number;
    reason: string;
  }>;
}

export const optimizeParametersWithGrok = async (
  request: GrokOptimizationRequest,
  apiKey: string
): Promise<GrokOptimizationResponse> => {
  const prompt = `Analyze this time series data and optimize parameters for ${request.modelType} forecasting model.

Historical data: ${request.historicalData.slice(-20).join(', ')} (showing last 20 points)
Current parameters: ${JSON.stringify(request.currentParameters)}
Seasonal period: ${request.seasonalPeriod || 'unknown'}
Target metric: ${request.targetMetric}

Please recommend optimal parameter values that would minimize ${request.targetMetric.toUpperCase()}. Consider:
1. Data volatility and trends
2. Seasonal patterns if present
3. Parameter constraints (alpha, beta, gamma: 0.1-1.0, window: 1-30)
4. Balance between responsiveness and stability

Respond in JSON format:
{
  "optimizedParameters": {"param1": value1, "param2": value2},
  "expectedAccuracy": percentage,
  "confidence": percentage,
  "reasoning": "explanation of choices"
}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an expert time series forecasting analyst. Provide precise, data-driven parameter optimization recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-beta',
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Unable to parse optimization response');
    }
  } catch (error) {
    console.error('Grok optimization error:', error);
    throw error;
  }
};

export const getModelRecommendation = async (
  historicalData: number[],
  dataFrequency: string,
  apiKey: string
): Promise<GrokModelRecommendation> => {
  const prompt = `Analyze this time series data and recommend the best forecasting model.

Data: ${historicalData.slice(-30).join(', ')} (last 30 points)
Frequency: ${dataFrequency}
Data length: ${historicalData.length} points

Available models:
1. Simple Moving Average - Good for stable data with minimal trend
2. Exponential Smoothing - Good for data with trend but no seasonality
3. Linear Trend - Good for data with consistent linear growth/decline
4. Seasonal Moving Average - Good for data with seasonal patterns
5. Holt-Winters - Best for data with trend AND seasonality
6. Seasonal Naive - Simple baseline for seasonal data

Analyze:
- Trend presence and strength
- Seasonal patterns
- Data volatility
- Stationarity

Recommend the best model and rank alternatives.

Respond in JSON format:
{
  "recommendedModel": "model_name",
  "confidence": percentage,
  "reasoning": "detailed explanation",
  "alternativeModels": [
    {"model": "name", "score": percentage, "reason": "why it's good"}
  ]
}`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are an expert time series analyst. Analyze data patterns and recommend optimal forecasting models.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-beta',
        temperature: 0.2,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Unable to parse recommendation response');
    }
  } catch (error) {
    console.error('Grok recommendation error:', error);
    throw error;
  }
};
