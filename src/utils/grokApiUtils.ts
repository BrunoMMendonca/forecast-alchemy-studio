export interface GrokOptimizationRequest {
  modelType: string;
  historicalData: number[];
  currentParameters: Record<string, number>;
  seasonalPeriod?: number;
  targetMetric: 'accuracy' | 'mape' | 'mae' | 'rmse';
  dataStats?: {
    mean: number;
    std: number;
    trend: string;
    seasonality: boolean;
    volatility: number;
    cycles: number[];
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

// Enhanced data statistics calculation with cycle detection
const calculateDataStats = (data: number[]) => {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance);
  
  // Enhanced trend detection using linear regression
  const n = data.length;
  const xSum = (n * (n - 1)) / 2;
  const ySum = data.reduce((sum, val) => sum + val, 0);
  const xySum = data.reduce((sum, val, i) => sum + val * i, 0);
  const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
  const trendStrength = Math.abs(slope) / mean;
  
  let trend = 'stable';
  if (trendStrength > 0.02) {
    trend = slope > 0 ? 'increasing' : 'decreasing';
  }
  
  // Enhanced seasonality and cycle detection
  const volatility = std / mean;
  
  // Detect potential cycles using autocorrelation-like approach
  const cycles: number[] = [];
  for (let lag = 2; lag <= Math.min(12, Math.floor(data.length / 3)); lag++) {
    let correlation = 0;
    let count = 0;
    for (let i = lag; i < data.length; i++) {
      correlation += Math.abs(data[i] - data[i - lag]);
      count++;
    }
    const avgDiff = correlation / count;
    const threshold = std * 0.5; // Adjust threshold based on data variability
    
    if (avgDiff < threshold) {
      cycles.push(lag);
    }
  }
  
  const seasonality = cycles.length > 0 || (volatility > 0.15 && data.length >= 12);
  
  return {
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    trend,
    seasonality,
    volatility: Math.round(volatility * 100) / 100,
    cycles: cycles.slice(0, 3) // Top 3 detected cycles
  };
};

export const optimizeParametersWithGrok = async (
  request: GrokOptimizationRequest,
  apiKey: string
): Promise<GrokOptimizationResponse> => {
  // Provide more comprehensive data context (last 100 points instead of 50)
  const dataPoints = request.historicalData.slice(-100);
  const dataStats = calculateDataStats(request.historicalData);
  
  const prompt = `Analyze this time series data and optimize parameters for ${request.modelType} forecasting model.

COMPREHENSIVE HISTORICAL DATA (last 100 points): ${dataPoints.join(', ')}

ENHANCED DATA STATISTICS:
- Mean: ${dataStats.mean}
- Standard Deviation: ${dataStats.std}
- Trend: ${dataStats.trend}
- Volatility: ${dataStats.volatility}
- Has Seasonality: ${dataStats.seasonality}
- Detected Cycles: ${dataStats.cycles.length > 0 ? dataStats.cycles.join(', ') : 'none'}
- Seasonal Period: ${request.seasonalPeriod || 'unknown'}
- Data Length: ${request.historicalData.length} points

CURRENT PARAMETERS: ${JSON.stringify(request.currentParameters)}
TARGET METRIC: ${request.targetMetric} (we want to MAXIMIZE accuracy, which means MINIMIZE MAPE)

PARAMETER CONSTRAINTS for ${request.modelType}:
- simple_exponential_smoothing: alpha (0.05-0.95) - Lower values (0.1-0.3) for stable data, higher (0.4-0.8) for volatile/trending data
- double_exponential_smoothing: alpha (0.05-0.95), beta (0.05-0.95) - Alpha smooths level, beta smooths trend
- holt_winters: alpha (0.05-0.95), beta (0.05-0.95), gamma (0.05-0.95) - Gamma smooths seasonality
- moving_average: window (2-20) - Consider detected cycles: ${dataStats.cycles.join(', ') || 'none detected'}

OPTIMIZATION STRATEGY:
1. For HIGH volatility (>0.3): More responsive parameters (alpha: 0.4-0.8, smaller windows: 2-5)
2. For MEDIUM volatility (0.15-0.3): Balanced parameters (alpha: 0.2-0.5, windows: 3-8)
3. For LOW volatility (<0.15): Stable parameters (alpha: 0.1-0.3, larger windows: 6-12)
4. For TRENDING data: Ensure beta is proportional to trend strength (0.1-0.4)
5. For SEASONAL data: Use detected cycles for window sizing, gamma should reflect seasonal strength
6. For MOVING AVERAGE: If cycles detected, prefer window sizes that are divisors or multiples of cycle length

CRITICAL: Your goal is to MAXIMIZE ACCURACY (minimize MAPE). Consider that accuracy = 100 - MAPE.
Test your parameter suggestions mentally against the data patterns you observe.

Respond in JSON format only:
{
  "optimizedParameters": {"param1": value1, "param2": value2},
  "expectedAccuracy": percentage_between_60_and_95,
  "confidence": percentage_between_60_and_95,
  "reasoning": "detailed explanation focusing on why these parameters will maximize accuracy based on the specific data patterns observed"
}`;

  try {
    console.log(`🤖 Enhanced optimization request to Grok for ${request.modelType} (target: ${request.targetMetric})`);
    
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
            content: 'You are an expert time series forecasting analyst. Your goal is to maximize forecast accuracy by selecting optimal parameters based on comprehensive data analysis. Focus on patterns, cycles, and statistical properties to make data-driven recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-3',
        temperature: 0.05, // Lower temperature for more consistent optimization
        max_tokens: 1200
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log(`🤖 Enhanced Grok response received for ${request.modelType}`);
    
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate the response has required fields
      if (!result.optimizedParameters || !result.expectedAccuracy || !result.confidence) {
        throw new Error('Invalid response format from Grok API');
      }
      
      console.log(`✅ Enhanced optimization result: ${JSON.stringify(result.optimizedParameters)}`);
      console.log(`📊 Expected accuracy: ${result.expectedAccuracy}%, Confidence: ${result.confidence}%`);
      return result;
    } else {
      throw new Error('Unable to parse optimization response - no valid JSON found');
    }
  } catch (error) {
    console.error(`❌ Enhanced optimization error for ${request.modelType}:`, error);
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
