
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
  businessContext?: {
    costOfError?: 'low' | 'medium' | 'high';
    planningPurpose?: 'operational' | 'tactical' | 'strategic';
    updateFrequency?: 'daily' | 'weekly' | 'monthly';
    interpretabilityNeeds?: 'low' | 'medium' | 'high';
  };
}

export interface GrokOptimizationResponse {
  optimizedParameters: Record<string, number>;
  expectedAccuracy: number;
  confidence: number;
  reasoning: string;
  factors?: {
    stability: number;
    interpretability: number;
    complexity: number;
    businessImpact: string;
  };
}

export interface GrokModelRecommendation {
  recommendedModel: string;
  confidence: number;
  reasoning: string;
  alternativeModels: Array<{
    model: string;
    score: number;
    reason: string;
    accuracy: number;
    stability: number;
    interpretability: number;
    businessFit: number;
  }>;
  decisionFactors: {
    accuracyWeight: number;
    stabilityWeight: number;
    interpretabilityWeight: number;
    businessWeight: number;
  };
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
  apiKey: string,
  gridBaseline?: { parameters: Record<string, number>; accuracy: number } // NEW: Grid baseline
): Promise<GrokOptimizationResponse> => {
  // Provide more comprehensive data context (last 100 points instead of 50)
  const dataPoints = request.historicalData.slice(-100);
  const dataStats = calculateDataStats(request.historicalData);
  
  const businessContextText = request.businessContext ? `
BUSINESS CONTEXT:
- Cost of Forecast Error: ${request.businessContext.costOfError || 'medium'} (affects parameter conservativeness)
- Planning Purpose: ${request.businessContext.planningPurpose || 'tactical'} planning
- Update Frequency: ${request.businessContext.updateFrequency || 'weekly'} model updates
- Interpretability Needs: ${request.businessContext.interpretabilityNeeds || 'medium'} (simpler models preferred if high)
` : '';

  // NEW: Grid baseline context
  const gridBaselineText = gridBaseline ? `
GRID SEARCH BASELINE (YOUR REFERENCE POINT):
- Grid-optimized parameters: ${JSON.stringify(gridBaseline.parameters)}
- Grid accuracy: ${gridBaseline.accuracy.toFixed(2)}%
- YOUR GOAL: Improve upon these grid-searched parameters with AI-driven insights
- MINIMUM IMPROVEMENT NEEDED: 2% accuracy gain to justify AI optimization
` : '';

  const prompt = `Analyze this time series data and IMPROVE UPON THE GRID-SEARCHED BASELINE parameters for ${request.modelType} forecasting model.

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

${businessContextText}

${gridBaselineText}

ORIGINAL PARAMETERS: ${JSON.stringify(request.currentParameters)}
TARGET METRIC: ${request.targetMetric} (we want to MAXIMIZE accuracy, which means MINIMIZE MAPE)

${gridBaseline ? 
  `CRITICAL TASK: The grid search has already found good parameters. Your job is to use AI insights to REFINE and IMPROVE upon these grid results. You need to show at least 2% accuracy improvement to justify the AI optimization.

Focus on:
1. Fine-tuning the grid parameters based on data patterns
2. Considering business context that grid search cannot
3. Applying domain expertise about forecasting
4. Making small, intelligent adjustments rather than dramatic changes` :
  `STANDARD OPTIMIZATION: No grid baseline available, perform full parameter optimization.`
}

PARAMETER CONSTRAINTS for ${request.modelType}:
- simple_exponential_smoothing: alpha (0.05-0.95) - Lower values (0.1-0.3) for stable data, higher (0.4-0.8) for volatile/trending data
- double_exponential_smoothing: alpha (0.05-0.95), beta (0.05-0.95) - Alpha smooths level, beta smooths trend
- holt_winters: alpha (0.05-0.95), beta (0.05-0.95), gamma (0.05-0.95) - Gamma smooths seasonality
- moving_average: window (2-20) - Consider detected cycles: ${dataStats.cycles.join(', ') || 'none detected'}

MULTI-CRITERIA OPTIMIZATION STRATEGY:
1. PRIMARY: Accuracy (40% weight) - ${gridBaseline ? 'MUST beat grid accuracy by 2%+' : 'Minimize MAPE to maximize forecast precision'}
2. STABILITY (25% weight) - Parameter robustness across different data periods
3. INTERPRETABILITY (20% weight) - How easily stakeholders can understand the model
4. BUSINESS IMPACT (15% weight) - Alignment with business context and error costs

For HIGH volatility (>0.3): Balance responsiveness with stability
For MEDIUM volatility (0.15-0.3): Optimize for accuracy with moderate stability
For LOW volatility (<0.15): Prioritize long-term stability and interpretability

CRITICAL: ${gridBaseline ? 'You MUST justify why your parameters are better than the grid baseline. If you cannot achieve meaningful improvement, suggest staying with grid parameters.' : 'Consider ALL four criteria in your optimization decision. Explain the trade-offs you\'re making between accuracy, stability, interpretability, and business impact.'}

Respond in JSON format only:
{
  "optimizedParameters": {"param1": value1, "param2": value2},
  "expectedAccuracy": percentage_between_60_and_95,
  "confidence": percentage_between_60_and_95,
  "reasoning": "${gridBaseline ? 'detailed explanation of how and why your parameters improve upon the grid baseline, with specific accuracy improvement justification' : 'detailed explanation covering all four decision criteria and the specific trade-offs made'}",
  "factors": {
    "stability": percentage_score_0_to_100,
    "interpretability": percentage_score_0_to_100,
    "complexity": percentage_score_0_to_100,
    "businessImpact": "brief description of expected business impact"
  }
}`;

  try {
    console.log(`🤖 ${gridBaseline ? 'Grid-baseline-aware' : 'Enhanced multi-criteria'} optimization request to Grok for ${request.modelType}`);
    
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
            content: `You are an expert time series forecasting analyst with deep understanding of business requirements. ${gridBaseline ? 'Your specialty is refining grid-searched parameters using AI insights. You only recommend changes if you can achieve meaningful improvement (2%+ accuracy gain).' : 'Your goal is to balance multiple criteria: accuracy, stability, interpretability, and business impact.'} Always provide detailed reasoning covering all decision factors and trade-offs.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-3',
        temperature: 0.05, // Lower temperature for more consistent optimization
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log(`🤖 ${gridBaseline ? 'Grid-baseline-aware' : 'Enhanced multi-criteria'} Grok response received for ${request.modelType}`);
    
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Validate the response has required fields
      if (!result.optimizedParameters || !result.expectedAccuracy || !result.confidence) {
        throw new Error('Invalid response format from Grok API');
      }
      
      console.log(`✅ ${gridBaseline ? 'Grid-baseline-aware' : 'Multi-criteria'} optimization result: ${JSON.stringify(result.optimizedParameters)}`);
      console.log(`📊 Expected accuracy: ${result.expectedAccuracy}%, Confidence: ${result.confidence}%`);
      console.log(`🎯 Factors:`, result.factors);
      return result;
    } else {
      throw new Error('Unable to parse optimization response - no valid JSON found');
    }
  } catch (error) {
    console.error(`❌ ${gridBaseline ? 'Grid-baseline-aware' : 'Enhanced multi-criteria'} optimization error for ${request.modelType}:`, error);
    throw error;
  }
};

export const getModelRecommendation = async (
  historicalData: number[],
  dataFrequency: string,
  apiKey: string,
  businessContext?: {
    costOfError?: 'low' | 'medium' | 'high';
    planningPurpose?: 'operational' | 'tactical' | 'strategic';
    interpretabilityNeeds?: 'low' | 'medium' | 'high';
  }
): Promise<GrokModelRecommendation> => {
  const dataStats = calculateDataStats(historicalData);
  
  const businessContextText = businessContext ? `
BUSINESS CONTEXT:
- Cost of Forecast Error: ${businessContext.costOfError || 'medium'} (high = favor stable models, low = favor accurate models)
- Planning Purpose: ${businessContext.planningPurpose || 'tactical'} planning (affects model complexity preference)
- Interpretability Needs: ${businessContext.interpretabilityNeeds || 'medium'} (high = favor simpler models)
` : '';

  const prompt = `Analyze this time series data and recommend the best forecasting model using MULTI-CRITERIA DECISION MAKING.

Data: ${historicalData.slice(-30).join(', ')} (last 30 points)
Frequency: ${dataFrequency}
Data length: ${historicalData.length} points

DATA ANALYSIS:
- Volatility: ${dataStats.volatility} (trend: ${dataStats.trend})
- Seasonality: ${dataStats.seasonality} (cycles: ${dataStats.cycles.join(', ') || 'none'})
- Mean: ${dataStats.mean}, Std: ${dataStats.std}

${businessContextText}

Available models:
1. Simple Moving Average - High interpretability, medium accuracy for stable data
2. Simple Exponential Smoothing - Good balance, moderate interpretability (alpha parameter)
3. Double Exponential Smoothing (Holt) - Better for trends, moderate complexity (alpha, beta)
4. Linear Trend - High interpretability for linear growth, limited flexibility
5. Seasonal Moving Average - Good for seasonal data, high interpretability
6. Holt-Winters (Triple Exponential) - Best for complex patterns, lower interpretability (alpha, beta, gamma)
7. Seasonal Naive - Baseline for seasonal data, highest interpretability

DECISION CRITERIA WEIGHTS (adapt based on context):
- Accuracy: 40% (forecast precision)
- Stability: 25% (robustness across time periods)
- Interpretability: 20% (stakeholder understanding)
- Business Fit: 15% (alignment with business needs)

For each model, score all four criteria (0-100) and calculate weighted score. Provide detailed reasoning for rankings considering the trade-offs between accuracy, complexity, and business requirements.

Respond in JSON format:
{
  "recommendedModel": "model_name",
  "confidence": percentage,
  "reasoning": "comprehensive explanation covering all decision criteria and trade-offs",
  "alternativeModels": [
    {
      "model": "name", 
      "score": weighted_percentage, 
      "reason": "criteria-based explanation",
      "accuracy": score_0_to_100,
      "stability": score_0_to_100,
      "interpretability": score_0_to_100,
      "businessFit": score_0_to_100
    }
  ],
  "decisionFactors": {
    "accuracyWeight": 40,
    "stabilityWeight": 25,
    "interpretabilityWeight": 20,
    "businessWeight": 15
  }
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
            content: 'You are an expert time series analyst with deep business acumen. Analyze data patterns and recommend optimal forecasting models considering accuracy, stability, interpretability, and business impact. Always provide multi-criteria reasoning with specific scores and trade-off explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-3',
        temperature: 0.2,
        max_tokens: 1500
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
