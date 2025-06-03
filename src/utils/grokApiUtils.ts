export interface GrokOptimizationRequest {
  modelType: string;
  historicalData: number[];
  currentParameters: Record<string, number>;
  seasonalPeriod?: number;
  targetMetric: 'mape' | 'mae' | 'rmse';
  dataStats?: {
    mean: number;
    std: number;
    trend: string;
    seasonality: boolean;
    volatility: number;
  };
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

// Calculate data statistics to provide better context to AI
const calculateDataStats = (data: number[]) => {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance);
  
  // Simple trend detection
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  const firstMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondMean > firstMean * 1.1) trend = 'increasing';
  else if (secondMean < firstMean * 0.9) trend = 'decreasing';
  
  // Simple seasonality detection (look for patterns)
  const volatility = std / mean;
  const seasonality = volatility > 0.2 && data.length >= 12;
  
  return {
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    trend,
    seasonality,
    volatility: Math.round(volatility * 100) / 100
  };
};

export const optimizeParametersWithGrok = async (
  request: GrokOptimizationRequest,
  apiKey: string
): Promise<GrokOptimizationResponse> => {
  // Provide more data context (last 50 points instead of 20)
  const dataPoints = request.historicalData.slice(-50);
  const dataStats = calculateDataStats(request.historicalData);
  
  const prompt = `Analyze this time series data and optimize parameters for ${request.modelType} forecasting model.

FULL HISTORICAL DATA (last 50 points): ${dataPoints.join(', ')}
DATA STATISTICS:
- Mean: ${dataStats.mean}
- Standard Deviation: ${dataStats.std}
- Trend: ${dataStats.trend}
- Volatility: ${dataStats.volatility}
- Has Seasonality: ${dataStats.seasonality}
- Seasonal Period: ${request.seasonalPeriod || 'unknown'}

CURRENT PARAMETERS: ${JSON.stringify(request.currentParameters)}
TARGET METRIC: ${request.targetMetric}

IMPORTANT CONSTRAINTS for ${request.modelType}:
- simple_exponential_smoothing: alpha (0.1-0.9) - Use lower alpha (0.1-0.3) for stable data, higher (0.4-0.9) for volatile data
- double_exponential_smoothing: alpha (0.1-0.9), beta (0.1-0.9) - Alpha for level, beta for trend
- holt_winters: alpha (0.1-0.9), beta (0.1-0.9), gamma (0.1-0.9) - Alpha for level, beta for trend, gamma for seasonality  
- moving_average: window (2-15) - Use smaller windows (2-5) for volatile data, larger (6-12) for stable data
- linear_trend: no parameters to optimize
- seasonal_moving_average: window (2-15) - Consider seasonal period when choosing window
- seasonal_naive: no parameters to optimize

OPTIMIZATION GUIDELINES:
1. For HIGH volatility (>0.3): Use more responsive parameters (higher alpha, smaller windows)
2. For LOW volatility (<0.2): Use more stable parameters (lower alpha, larger windows)
3. For TRENDING data: Ensure beta parameter is appropriate for trend strength
4. For SEASONAL data: Consider seasonal period in window selection and gamma values
5. VALIDATE your choices against the actual data patterns shown

Based on the data characteristics, recommend parameters that would minimize ${request.targetMetric.toUpperCase()} while being robust to outliers.

Respond in JSON format only:
{
  "optimizedParameters": {"param1": value1, "param2": value2},
  "expectedAccuracy": percentage_between_60_and_95,
  "confidence": percentage_between_60_and_95,
  "reasoning": "detailed explanation of parameter choices based on data analysis"
}`;

  try {
    console.log(`🤖 Sending enhanced optimization request to Grok for ${request.modelType}`);
    
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
            content: 'You are an expert time series forecasting analyst with deep knowledge of parameter optimization. Analyze the data patterns carefully and provide precise, data-driven recommendations that will actually improve forecast accuracy.'
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
      throw new Error(`Grok API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log(`🤖 Grok response received for ${request.modelType}`);
    
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate the response has required fields
      if (!result.optimizedParameters || !result.expectedAccuracy || !result.confidence) {
        throw new Error('Invalid response format from Grok API');
      }
      
      console.log(`✅ Grok optimization result: ${JSON.stringify(result.optimizedParameters)}`);
      return result;
    } else {
      throw new Error('Unable to parse optimization response - no valid JSON found');
    }
  } catch (error) {
    console.error(`❌ Grok optimization error for ${request.modelType}:`, error);
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
