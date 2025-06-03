
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

Model-specific parameter constraints:
- simple_exponential_smoothing: alpha (0.1-1.0) only - for stable data without trend
- double_exponential_smoothing: alpha (0.1-1.0), beta (0.1-1.0) - for data with trend but no seasonality  
- holt_winters: alpha (0.1-1.0), beta (0.1-1.0), gamma (0.1-1.0) - for data with trend and seasonality
- moving_average: window (1-30) only
- linear_trend: no parameters
- seasonal_moving_average: window (1-30) only
- seasonal_naive: no parameters

Please recommend optimal parameter values that would minimize ${request.targetMetric.toUpperCase()}. Consider:
1. Data volatility and trends
2. Seasonal patterns if present
3. Model-specific parameter constraints listed above
4. Balance between responsiveness and stability

IMPORTANT: Only return parameters that are valid for the specific model type. Do not suggest parameters that don't exist for the model.

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
            content: 'You are an expert time series forecasting analyst. Provide precise, data-driven parameter optimization recommendations that strictly match the available parameters for each model type.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-3',
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
2. Simple Exponential Smoothing - Good for stable data without trend (alpha parameter)
3. Double Exponential Smoothing (Holt) - Good for data with trend but no seasonality (alpha, beta parameters)
4. Linear Trend - Good for data with consistent linear growth/decline
5. Seasonal Moving Average - Good for data with seasonal patterns
6. Holt-Winters (Triple Exponential) - Best for data with trend AND seasonality (alpha, beta, gamma parameters)
7. Seasonal Naive - Simple baseline for seasonal data

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
        model: 'grok-3',
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
